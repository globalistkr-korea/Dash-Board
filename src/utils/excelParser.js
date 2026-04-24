import * as XLSX from 'xlsx';

// ─── 공통 헬퍼 ────────────────────────────────────────────────
const toNum = (v) => {
  if (v == null || v === '' || v === 0) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

// VND → 백만원 환산 (엑셀 내 단위가 VND 원화일 때)
// tieng viet So. 파일: "단위: 백만원" 표기 → 그대로 사용하되 /1,000,000 변환
const vndToMillionKrw = (v) => Math.round(toNum(v) / 1_000_000);

// ─── 1. 경영계획 파싱 (tieng viet So.) ────────────────────────
export function parsePlanFile(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const result = {};

  // 연도 → 시트명 매핑
  const sheetMap = {
    2023: '월별가마감(24년)',   // 2023년 실적은 24년 가마감에 포함되지 않으므로 별도 확인
    2024: '월별 가마감(24년)',
    2025: '월별가마감(25년)',
    2026: '월별가마감(26년)',
  };

  // 실제 시트 목록 확인 후 fallback
  const actualSheets = wb.SheetNames;

  for (const [year, sheetName] of Object.entries(sheetMap)) {
    // 우선 정확한 이름, 없으면 유사 이름 탐색
    let wsName = actualSheets.find(s => s === sheetName) ||
                 actualSheets.find(s => s.includes(`${year.toString().slice(2)}년`) && s.includes('가마감')) ||
                 actualSheets.find(s => s.includes(`${year}실적`));

    // 2023년은 '2023실적' 시트 사용
    if (Number(year) === 2023) {
      wsName = actualSheets.find(s => s === '2023실적') || wsName;
    }

    if (!wsName) continue;

    const ws = wb.Sheets[wsName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    result[year] = parseMonthlySheet(rows, Number(year));
  }

  return result;
}

function parseMonthlySheet(rows, year) {
  // 헤더 구조: row[2] = 구분 행, col 4-15 = 1월~12월
  // row[4]  = 매출,   row[19] = 직접원가,  row[34] = 간접원가
  // 2023실적 시트는 구조가 다를 수 있어 별도 처리

  const MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12];
  const COL_START = 4; // 1월 컬럼 인덱스

  // 매출/직접원가/간접원가 행 찾기
  let revRow = null, cogsRow = null, sgaRow = null;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const label1 = r[1];
    if (!revRow && label1 === '매출') revRow = i;
    else if (!cogsRow && label1 === '직접원가') cogsRow = i;
    else if (!sgaRow && label1 === '간접원가') sgaRow = i;
  }

  // 찾지 못한 경우 기본값 설정
  if (revRow === null) revRow = 4;
  if (cogsRow === null) cogsRow = 19;
  if (sgaRow === null) sgaRow = 34;

  // 월별 데이터 추출
  const monthly = MONTHS.map((month, idx) => {
    const col = COL_START + idx;
    const rev  = vndToMillionKrw(rows[revRow]?.[col]);
    const cogs = vndToMillionKrw(rows[cogsRow]?.[col]);
    const sga  = vndToMillionKrw(rows[sgaRow]?.[col]);
    const grossProfit = rev - cogs;
    const opProfit = grossProfit - sga;

    return {
      month,
      label: `${month}월`,
      revenue: rev,
      grossProfit,
      operatingProfit: opProfit,
    };
  });

  // 연간 합계
  const annual = monthly.reduce(
    (acc, m) => ({
      revenue: acc.revenue + m.revenue,
      grossProfit: acc.grossProfit + m.grossProfit,
      operatingProfit: acc.operatingProfit + m.operatingProfit,
    }),
    { revenue: 0, grossProfit: 0, operatingProfit: 0 }
  );

  return { monthly, annual, year };
}


// ─── 2. 고객실적 파싱 (khach hang) ────────────────────────────
export function parseCustomerFile(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });

  const wsName = wb.SheetNames.find(s => s.includes('고객별') && s.includes('월별실적'))
    || wb.SheetNames.find(s => s.includes('Data') && s.includes('고객'));

  if (!wsName) return [];

  const ws = wb.Sheets[wsName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // 헤더: row[3] 기준
  // col2=법인, col3=고객명, col5=조직1, col8=계약형태, col11=산업군, col15=사업영역, col17=PL
  // 23년 실적: col18~34, 24년 실적: col35~51, 25년 실적: col52~68
  // 26년 실적: col75~91

  const YEAR_COL_MAP = {
    2023: { start: 18 },
    2024: { start: 36 },
    2025: { start: 54 },
    2026: { start: 75 },
  };

  // 데이터 행 수집 (row 4부터)
  const customerMap = {};

  for (let i = 4; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;

    const corporation = r[2] || '';
    const customerName = r[3] || '';
    const org1 = r[5] || '';
    const businessArea = r[15] || ''; // CL or FF
    const pl = r[17]; // '매출', '매출이익', '영업이익'

    if (!customerName || !pl) continue;
    // 베트남 법인만 필터
    const isVietnam = String(corporation).toLowerCase().includes('gemadept') ||
                      String(org1).toLowerCase().includes('glc') ||
                      String(org1).toLowerCase().includes('gvf') ||
                      String(corporation).toLowerCase().includes('gvf');
    if (!isVietnam) continue;
    if (!['매출', '매출이익', '영업이익'].includes(pl)) continue;

    const key = `${corporation}||${customerName}||${businessArea}`;

    if (!customerMap[key]) {
      customerMap[key] = {
        corporation,
        customerName,
        org1,
        businessArea,
        data: {},
      };
    }

    for (const [year, { start }] of Object.entries(YEAR_COL_MAP)) {
      if (!customerMap[key].data[year]) {
        customerMap[key].data[year] = {
          monthly: Array(12).fill(null).map((_, idx) => ({
            month: idx + 1,
            label: `${idx+1}월`,
            revenue: 0, grossProfit: 0, operatingProfit: 0
          })),
        };
      }

      for (let m = 0; m < 12; m++) {
        const val = vndToMillionKrw(r[start + m]);
        const entry = customerMap[key].data[year].monthly[m];
        if (pl === '매출') entry.revenue = val;
        else if (pl === '매출이익') entry.grossProfit = val;
        else if (pl === '영업이익') entry.operatingProfit = val;
      }
    }
  }

  // annual 합계 계산
  const customers = Object.values(customerMap).map(c => {
    for (const year of Object.keys(c.data)) {
      const monthly = c.data[year].monthly;
      c.data[year].annual = monthly.reduce(
        (acc, m) => ({
          revenue: acc.revenue + m.revenue,
          grossProfit: acc.grossProfit + m.grossProfit,
          operatingProfit: acc.operatingProfit + m.operatingProfit,
        }),
        { revenue: 0, grossProfit: 0, operatingProfit: 0 }
      );
    }
    return c;
  });

  return customers;
}


// ─── 3. 창고실적 파싱 (kho tieng viet) ───────────────────────
export function parseWarehouseFile(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });

  // '피벗' 시트 사용
  const wsName = wb.SheetNames.find(s => s === '피벗') || wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // 헤더 행 찾기 (센터명, 매출, 매출이익, 영업이익 포함 행)
  let headerRow = -1;
  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const r = rows[i];
    if (r && r.some(c => c === '센터명') && r.some(c => c === '매출')) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) headerRow = 16;

  const hRow = rows[headerRow] || [];

  // 컬럼 인덱스 찾기
  const colIdx = {};
  const findCol = (label) => hRow.findIndex(c => c === label);
  colIdx.no2       = findCol('NO2');
  colIdx.division  = hRow.findIndex(c => c === '신 본부' || c === '본부');
  colIdx.exclude   = findCol('제외대상');
  colIdx.group     = hRow.findIndex(c => c === '사업 그룹핑');
  colIdx.corp      = hRow.findIndex(c => c === '법인명');
  colIdx.country   = findCol('국가');
  colIdx.region    = hRow.findIndex(c => c === '팀/파트/지역/지사');
  colIdx.center    = findCol('센터명');
  colIdx.selfOwn   = findCol('자가구분');
  colIdx.bizLv1    = hRow.findIndex(c => c === '사업군 Lv1');
  colIdx.bizLv2    = hRow.findIndex(c => c === '사업군 Lv2');

  // 월별 데이터 컬럼: 헤더 행 다음 행에서 월 레이블 찾기
  // 피벗 구조: 각 월마다 매출/매출이익/매출이익(%)/영업이익/영업이익(%) 컬럼 반복
  // row[headerRow-1] 에 "합계 : 1월3" 같은 레이블 있음
  const MONTHS = 12;
  const COLS_PER_MONTH = 5; // 매출, 매출이익, 매출이익%, 영업이익, 영업이익%

  // 첫번째 데이터 컬럼 위치 = colIdx.center 다음부터
  const dataStartCol = hRow.findIndex((c, idx) => idx > (colIdx.bizLv2 || 18) && c === '매출');

  const warehouses = [];

  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[colIdx.center]) continue;

    const exclude = r[colIdx.exclude];
    if (exclude === '제외') continue;

    const country = r[colIdx.country] || '';
    // 베트남만 필터
    if (!String(country).includes('베트남') && !String(country).toLowerCase().includes('vietnam')) continue;

    const center = r[colIdx.center] || '';
    const corp   = r[colIdx.corp] || '';
    const region = r[colIdx.region] || '';
    const bizLv2 = r[colIdx.bizLv2] || '';
    const group  = r[colIdx.group] || '';

    // 월별 실적 추출
    const monthly = [];
    if (dataStartCol >= 0) {
      for (let m = 0; m < MONTHS; m++) {
        const base = dataStartCol + m * COLS_PER_MONTH;
        monthly.push({
          month: m + 1,
          label: `${m+1}월`,
          revenue:          vndToMillionKrw(r[base]),
          grossProfit:      vndToMillionKrw(r[base + 1]),
          operatingProfit:  vndToMillionKrw(r[base + 3]),
        });
      }
    }

    const annual = monthly.reduce(
      (acc, m) => ({
        revenue: acc.revenue + m.revenue,
        grossProfit: acc.grossProfit + m.grossProfit,
        operatingProfit: acc.operatingProfit + m.operatingProfit,
      }),
      { revenue: 0, grossProfit: 0, operatingProfit: 0 }
    );

    warehouses.push({
      center,
      corporation: corp,
      country,
      region,
      businessType: bizLv2,
      group,
      monthly,
      annual,
    });
  }

  return warehouses;
}
