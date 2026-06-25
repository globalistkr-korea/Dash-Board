#!/usr/bin/env python3
"""
구글 시트('클로드) 대쉬보드 내용')의 Drive MCP 덤프(JSON {fileContent})를
앱이 쓰는 src/data/dashboard.json 으로 변환한다.

사용: python3 scripts/parse_sheet.py <mcp_dump.txt> [out.json]
덤프는 Claude가 read_file_content 로 받아 tool-results/ 에 저장된 파일.
시트 구조가 바뀌면 이 스크립트의 블록 경계 탐지 로직을 손보면 된다.
"""
import json, sys, re, os

DUMP = sys.argv[1]
OUT  = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
    os.path.dirname(__file__), "..", "src", "data", "dashboard.json")

KRW_RATE = 0.056  # 1 VND = 0.056 KRW (고정, 설정에서 변경)
WH_MAP = {"Oriental": "Hai Nam", "SK": "AJ", "PACKEXIM": "PACKEXIM"}  # 거점 → 이전 후 창고

lines = json.load(open(DUMP))["fileContent"].split("\n")

def cells(i):
    if i < 0 or i >= len(lines):
        return []
    return [p.strip() for p in lines[i].split("|")][1:-1]

def num(s):
    if s is None:
        return None
    s = str(s).replace(",", "").replace("\\-", "-").replace("%", "").strip()
    if s in ("", "-"):
        return None
    try:
        return float(s)
    except ValueError:
        return None

def find_row(pred, start=0, end=None):
    end = end if end is not None else len(lines)
    for i in range(start, end):
        if pred(cells(i)):
            return i
    return -1

# ─── 블록 경계 탐지 (라벨 기반, 위치 바뀌어도 견딤) ──────────────
raw_hdr_i  = find_row(lambda c: len(c) > 3 and c[0] == "구분" and "Revenue" in c)
wh_hdr_i   = find_row(lambda c: "Warehouse ID" in c and "Warehouse Name" in c)
cli_hdr_i  = find_row(lambda c: "Client" in c and "WH" in c and "Contract start" in c, start=wh_hdr_i+1 if wh_hdr_i>0 else 0)
ven_hdr_i  = find_row(lambda c: "Vendor Name" in c and "Operation Scppe" in c)

# ─── A. 경영계획 ──────────────────────────────────────────────
def parse_plan():
    hdr = cells(0)
    # 월 컬럼: cells[4..15] = 1~12월, cells[16] = YEAR
    months = []
    for k in range(12):
        h = hdr[4 + k] if 4 + k < len(hdr) else f"{k+1}월"
        m = re.match(r"(\d+)월/(\S+)", h)
        if m:
            months.append({"month": int(m.group(1)), "type": m.group(2)})
        else:
            months.append({"month": k + 1, "type": "계획"})

    plan_end = raw_hdr_i if raw_hdr_i > 0 else 190

    def row_vals(i):
        c = cells(i)
        return [num(c[4 + k]) if 4 + k < len(c) else None for k in range(12)]

    # 대분류(col1) 첫 등장 = 전체. 그 아래 col3 == 'CL'/'FF' 첫 행.
    def metric(label):
        top = find_row(lambda c: len(c) > 1 and c[1] == label, 0, plan_end)
        if top < 0:
            return None
        # 다음 대분류 전까지 범위에서 CL/FF 탐색
        nxt = plan_end
        for i in range(top + 1, plan_end):
            c = cells(i)
            if len(c) > 1 and c[1] and c[1] not in ("%", "전체", "구분"):
                nxt = i
                break
        cl = find_row(lambda c: len(c) > 3 and c[3] == "CL", top + 1, nxt)
        ff = find_row(lambda c: len(c) > 3 and c[3] == "FF", top + 1, nxt)
        return {
            "total": row_vals(top),
            "CL": row_vals(cl) if cl > 0 else None,
            "FF": row_vals(ff) if ff > 0 else None,
        }

    return {
        "months": months,
        "metrics": {
            "매출":   metric("매출"),
            "직접원가": metric("직접원가"),
            "매출이익": metric("매출이익"),
            "영업이익": metric("영업이익"),
        },
    }

# ─── B. 월별 raw 실적 ─────────────────────────────────────────
def parse_raw():
    if raw_hdr_i < 0:
        return []
    hdr = cells(raw_hdr_i)
    def ci(name):
        return hdr.index(name) if name in hdr else -1
    cols = {k: ci(v) for k, v in {
        "year": "년", "month": "월", "biz": "사업", "hub": "거점",
        "hoha": "HO/HA",
        "endUser": "End User", "customer": "고객명 (본사)", "customer2": "고객명",
        "industry": "산업군(25.1월부)", "clff": "CL/FF",
        "revenue": "Revenue", "handling": "01\\. HANDLING FEE",
        "transport": "03\\. TRANSPORTATION", "storage": "05\\. RENTAL FEE(WH)",
        "directCost": "Direct Cost", "directProfit": "Direct Profit",
        "grossProfit": "Gross Profit", "opProfit": "영업이익",
    }.items()}

    # raw 끝 = 다음 빈 블록 또는 창고 마스터 시작
    end = wh_hdr_i if wh_hdr_i > raw_hdr_i else len(lines)
    out = []
    for i in range(raw_hdr_i + 2, end):  # +2: 헤더 + 구분선
        c = cells(i)
        if len(c) <= cols["revenue"] or not c[cols["customer"]]:
            continue
        hub = c[cols["hub"]] if cols["hub"] >= 0 else ""
        hoha = c[cols["hoha"]] if cols["hoha"] >= 0 else ""
        # HO/HA: VNHA=북부(하노이), 그 외 값이 있으면 남부
        region = "북부" if hoha == "VNHA" else ("남부" if hoha.strip() else "미지정")
        rec = {
            "year": c[cols["year"]] if cols["year"] >= 0 else "",
            "month": c[cols["month"]] if cols["month"] >= 0 else "",
            "biz": c[cols["biz"]] if cols["biz"] >= 0 else "",     # LD=운송 / WH=창고
            "hub": hub,                                            # 표시용 거점
            "hoha": hoha,
            "region": region,                                      # 북부/남부
            "warehouse": WH_MAP.get(hub, hub),                     # 이전 반영 창고
            "customer": c[cols["customer"]] if cols["customer"] >= 0 else "",
            "industry": c[cols["industry"]] if cols["industry"] >= 0 else "",
            "clff": c[cols["clff"]] if cols["clff"] >= 0 else "",
            "revenue": num(c[cols["revenue"]]),
            "handling": num(c[cols["handling"]]) if cols["handling"] >= 0 else None,
            "transport": num(c[cols["transport"]]) if cols["transport"] >= 0 else None,
            "storage": num(c[cols["storage"]]) if cols["storage"] >= 0 else None,
            "directCost": num(c[cols["directCost"]]) if cols["directCost"] >= 0 else None,
            "directProfit": num(c[cols["directProfit"]]) if cols["directProfit"] >= 0 else None,
            "grossProfit": num(c[cols["grossProfit"]]) if cols["grossProfit"] >= 0 else None,
            "opProfit": num(c[cols["opProfit"]]) if cols["opProfit"] >= 0 else None,
        }
        out.append(rec)
    return out

# ─── C/D/E. 마스터·계약 블록 (헤더→행 dict) ────────────────────
def parse_table(hdr_i, stop_at):
    if hdr_i < 0:
        return []
    hdr = cells(hdr_i)
    out = []
    for i in range(hdr_i + 2, stop_at if stop_at > 0 else len(lines)):
        c = cells(i)
        if not c or all(x == "" for x in c):
            continue
        if len(c) > 1 and not c[1]:
            continue
        row = {}
        for k, name in enumerate(hdr):
            if name and k < len(c):
                row[name] = c[k].replace("\\-", "-").replace("\\&", "&").replace("\\~", "~")
        if row:
            out.append(row)
    return out

data = {
    "meta": {
        "unitLabel": "백만동",
        "krwRate": KRW_RATE,
        "source": "구글 시트: 클로드) 대쉬보드 내용",
    },
    "plan": parse_plan(),
    "raw": parse_raw(),
    "warehouses": parse_table(wh_hdr_i, cli_hdr_i if cli_hdr_i > 0 else ven_hdr_i),
    "clientContracts": parse_table(cli_hdr_i, ven_hdr_i),
    "vendors": parse_table(ven_hdr_i, len(lines)),
}

os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
json.dump(data, open(OUT, "w"), ensure_ascii=False, indent=2)

# 요약 출력
print("블록 경계: raw=%d wh=%d cli=%d ven=%d" % (raw_hdr_i, wh_hdr_i, cli_hdr_i, ven_hdr_i))
print("plan metrics:", list(data["plan"]["metrics"].keys()))
print("매출 total(1~12):", data["plan"]["metrics"]["매출"]["total"])
print("매출 CL:", data["plan"]["metrics"]["매출"]["CL"])
print("raw rows:", len(data["raw"]))
if data["raw"]:
    r = data["raw"][0]
    print("raw sample:", {k: r[k] for k in ("hub","warehouse","biz","customer","clff","revenue","storage","handling","transport","opProfit")})
    from collections import Counter
    print("raw 거점→창고:", dict(Counter((x["hub"],x["warehouse"]) for x in data["raw"])))
print("warehouses:", len(data["warehouses"]), "/ clients:", len(data["clientContracts"]), "/ vendors:", len(data["vendors"]))
print("OUT:", os.path.abspath(OUT))
