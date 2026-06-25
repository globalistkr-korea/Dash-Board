#!/usr/bin/env python3
"""
'대쉬보드' 구글시트의 '지역' 탭들(1.1.1 26년 / 1.3 25년 / 1.4 24년)에서
베트남 경영실적/계획을 연도×지표×CL/FF×남북×세부로 정규화한다.

입력: xlsx 경로 (구글시트를 xlsx로 export 한 파일)
출력: src/data/plan3y.json

단위: 시트 표기 그대로 '백만원'.
컬럼 맵(0-base): idx3=지표, idx7=국가, idx9=CL/FF, idx10=남부/북부, idx11=세부,
                idx12=연간, idx13..24=1~12월.
"""
import sys, os, json, openpyxl

XLSX = sys.argv[1] if len(sys.argv) > 1 else "/tmp/dashboard.xlsx"
OUT  = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
    os.path.dirname(__file__), "..", "src", "data", "plan3y.json")

TABS = {
    "2024": "1.4 24년 (지역)",
    "2025": "1.3 25년 (지역)",
    "2026": "1.1.1 경영실적계획(26년,지역)",
}
ACTUAL_MONTHS = {"2024": 12, "2025": 12, "2026": 5}  # 실적 개월 수(나머지는 계획)
# 3개년 모두 깔끔히 집계되는 손익 항목만 파싱(판관비는 앱에서 매출이익-영업이익으로 도출)
METRICS = ["매출", "매출원가", "매출이익", "영업이익"]
ALL_HEADERS = {"매출", "매출원가", "매출이익", "전체 판매비", "법인 판매비",
               "본사 판매비(부문+본부)", "공헌 이익", "일반 관리비", "영업이익", "영업이익율"}
SUBTYPES_CL = {"WM", "TM", "S/P"}
SUBTYPES_FF = {"해상", "항공", "CC", "Haulage"}


def g(row, i):
    v = row[i] if i < len(row) else None
    return None if v in (None, "") else v


def num(v):
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).replace(",", "").replace("%", "").strip()
    if s in ("", "-"):
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def months(row):
    return [num(g(row, 13 + k)) for k in range(12)]


COUNTRIES = {"인도", "베트남", "중국", "말레이시아", "인도네시아", "태국",
             "싱가포르", "미얀마", "캄보디아", "필리핀", "라오스"}
LABEL_COLS = (7, 8, 9, 10, 11)  # 계층 라벨이 들어가는 컬럼 후보(국가~세부)


def row_label(row):
    """행의 '자기 라벨' = 계층 컬럼 중 가장 오른쪽(=가장 깊은) 비어있지 않은 값.
    반환 (depth=컬럼인덱스, 값) 또는 None."""
    for i in reversed(LABEL_COLS):
        v = g(row, i)
        if v not in (None, ""):
            return i, str(v).strip()
    return None


def find_metric_blocks(rows):
    """지표 블록 헤더 행 인덱스(0-base) → (이름, start, end) 목록."""
    cands = []
    for r, row in enumerate(rows):
        d = g(row, 3)
        if (d and isinstance(d, str) and d in ALL_HEADERS
                and not g(row, 0) and not g(row, 2) and not g(row, 5)
                and not g(row, 7) and not g(row, 9) and not g(row, 10)
                and not g(row, 11) and g(row, 12) is None):
            cands.append((r, d))
    # 블록 시작: 첫 '매출' + 이름이 '매출'이 아닌 헤더들
    starts = []
    for idx, (r, name) in enumerate(cands):
        if idx == 0 or name != "매출":
            starts.append((r, name))
    blocks = []
    for i, (r, name) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else len(rows)
        blocks.append((name, r, end))
    return blocks


def parse_vietnam(rows, start, end):
    """베트남 구간을 깊이-스택 트리로 파싱.
    말단(자식 없는) 행만 리프로 emit하고, 라벨 값으로 CL/FF·남북을 분류한다.
    컬럼 위치에 의존하지 않으므로 탭/엔티티별 시프트에 견딘다."""
    # 1) 첫 번째 베트남 구간 행 인덱스 수집 (idx7 국가 라벨 기준).
    #    일부 탭(24년)은 블록 내 베트남 트리가 두 번 반복되므로 첫 구간만 취한다.
    vn = []
    in_vn = False
    seen_vn = False
    for r in range(start, end):
        lab = g(rows[r], 7)
        if lab is not None and str(lab).strip() in COUNTRIES:
            in_vn = (str(lab).strip() == "베트남")
            if in_vn:
                if seen_vn:           # 이미 한 번 끝난 뒤 또 나오면 중단
                    break
                seen_vn = True
                vn.append(r)          # 베트남 총계 행 포함(루트)
            continue
        if in_vn:
            vn.append(r)

    # 2) 각 행의 (depth, label) 산출, 라벨 없는 행은 제외
    nodes = []
    for r in vn:
        rl = row_label(rows[r])
        if rl is None:
            continue
        nodes.append((r, rl[0], rl[1]))

    # 3) 트리 순회: 리프 = 다음 노드의 depth <= 현재 depth
    leaves = []
    stack = []  # [(depth,label)]
    for k, (r, depth, label) in enumerate(nodes):
        while stack and stack[-1][0] >= depth:
            stack.pop()
        stack.append((depth, label))
        is_leaf = (k + 1 >= len(nodes)) or (nodes[k + 1][1] <= depth)
        if not is_leaf:
            continue
        vals = months(rows[r])
        if not any(vals):
            continue
        # 조상(자기 포함)에서 CL/FF, 남부/북부 분류
        clff = next((lab for d, lab in reversed(stack) if lab in ("CL", "FF")), None)
        region = next((lab for d, lab in reversed(stack) if lab in ("남부", "북부")), "기타")
        leaves.append({"clff": clff or "CL", "region": region,
                       "subtype": label, "values": [round(v, 1) for v in vals]})
    return leaves


def main():
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    out = {"unit": "백만원", "years": list(TABS.keys()),
           "actualMonths": ACTUAL_MONTHS, "data": {}}
    for year, tab in TABS.items():
        ws = wb[tab]
        rows = list(ws.iter_rows(values_only=True))
        
        blocks = find_metric_blocks(rows)
        bmap = {name: (s, e) for name, s, e in blocks}
        ydata = {}
        for metric in METRICS:
            if metric not in bmap:
                continue
            s, e = bmap[metric]
            leaves = parse_vietnam(rows, s, e)
            total = [0.0] * 12
            for lf in leaves:
                for k in range(12):
                    total[k] += lf["values"][k]
            ydata[metric] = {"leaves": leaves,
                             "total": [round(x, 1) for x in total]}
        out["data"][year] = ydata
    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
    json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1)

    # ── 검증 출력 ──────────────────────────────────────────────
    for year in TABS:
        d = out["data"].get(year, {})
        for metric in METRICS:
            m = d.get(metric)
            if not m:
                print(f"{year} {metric}: (없음)")
                continue
            ann = sum(m["total"])
            def sub(pred):
                t = 0.0
                for lf in m["leaves"]:
                    if pred(lf):
                        t += sum(lf["values"])
                return t
            cl = sub(lambda l: l["clff"] == "CL")
            ff = sub(lambda l: l["clff"] == "FF")
            nam = sub(lambda l: l["region"] == "남부")
            buk = sub(lambda l: l["region"] == "북부")
            print(f"{year} {metric:5s} 연간={ann:11,.0f} | CL={cl:10,.0f} FF={ff:9,.0f} | 남={nam:10,.0f} 북={buk:9,.0f} | leaves={len(m['leaves'])}")
    print("OUT:", os.path.abspath(OUT))


if __name__ == "__main__":
    main()
