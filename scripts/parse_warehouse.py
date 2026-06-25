#!/usr/bin/env python3
"""
'대쉬보드' 시트 '2. 창고별' raw → 창고별/고객사별 월별 실적·원가.
세그먼트: 사업 컬럼(idx13)에서 도출 — 창고(WH/VAWD)·운송(LD/VATD)·FF(IFF/DFF)·기타.
CL = 창고 + 운송. 단위: 백만동.

출력: src/data/ops.json
구조: warehouses/customers[name] = {
  region, clff[], segs[],
  data: { seg: {revenue/directCost/grossProfit/opProfit{year:[12]}, items{name:{year:[12]}}} }
}
"""
import sys, os, json, openpyxl
from collections import defaultdict, Counter

XLSX = sys.argv[1] if len(sys.argv) > 1 else "/tmp/dashboard.xlsx"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
    os.path.dirname(__file__), "..", "src", "data", "ops.json")

WH_MAP = {"Oriental": "Hai Nam", "SK": "AJ", "DC Yen My": "SLS"}
M = 1_000_000.0
YEARS = ["2025", "2026"]
C_YEAR, C_MONTH, C_HUB, C_BIZ, C_HOHA, C_CUST = 3, 4, 12, 13, 14, 10
C_REV, C_DC, C_GP, C_OP = 19, 52, 55, 61
ITEM_COLS = list(range(20, 33))   # 직접원가 항목 01~13
CUST_MIN = 300                    # 고객사 최소 누적매출(백만동) 미만은 제외(노이즈/용량)


def seg_of(biz):
    b = str(biz).strip().upper()
    if b in ("WH", "VAWD"):
        return "창고"
    if b in ("LD", "VATD"):
        return "운송"
    if b in ("IFF", "DFF"):
        return "FF"
    return "기타"


def clff_of(seg):
    return "CL" if seg in ("창고", "운송") else ("FF" if seg == "FF" else "기타")


def region_of(hoha):
    h = str(hoha).strip()
    if h in ("VNHA", "North"):
        return "북부"
    if h in ("VNHO", "South"):
        return "남부"
    return "미지정"


def num(v):
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(",", "").strip())
    except ValueError:
        return 0.0


def mi(month):
    try:
        return int(str(month).replace("월", "").strip()) - 1
    except ValueError:
        return None


def blank():
    return {y: [0.0] * 12 for y in YEARS}


def main():
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    ws = wb["2. 창고별"]
    rows = list(ws.iter_rows(values_only=True))
    item_names = [str(rows[1][i]).strip() for i in ITEM_COLS]

    def new_seg():
        return {"revenue": blank(), "directCost": blank(), "grossProfit": blank(),
                "opProfit": blank(), "items": {n: blank() for n in item_names}}

    def new_entity():
        return {"region": Counter(), "segs": defaultdict(new_seg)}

    WH = defaultdict(new_entity)
    CU = defaultdict(new_entity)

    for r in rows[2:]:
        if len(r) <= C_OP:
            continue
        year = str(r[C_YEAR]).replace(".0", "").strip() if r[C_YEAR] not in (None, "") else ""
        if year not in YEARS:
            continue
        m = mi(r[C_MONTH])
        if m is None:
            continue
        hub = str(r[C_HUB]).strip() if r[C_HUB] not in (None, "") else ""
        wh = WH_MAP.get(hub, hub) or "(미지정)"
        cust = str(r[C_CUST]).strip() if r[C_CUST] not in (None, "") else "(미지정)"
        region = region_of(r[C_HOHA])
        seg = seg_of(r[C_BIZ])
        vals = {"revenue": num(r[C_REV]) / M, "directCost": num(r[C_DC]) / M,
                "grossProfit": num(r[C_GP]) / M, "opProfit": num(r[C_OP]) / M}
        items = {n: num(r[c]) / M for n, c in zip(item_names, ITEM_COLS)}

        for store, key in ((WH, wh), (CU, cust)):
            e = store[key]
            e["region"][region] += 1
            s = e["segs"][seg]
            for f, v in vals.items():
                s[f][year][m] += v
            for n, v in items.items():
                s["items"][n][year][m] += v

    def finalize(store, min_rev=0):
        out = {}
        rnd = lambda mp: {y: [round(x, 1) for x in arr] for y, arr in mp.items()}
        for name, e in store.items():
            tot = sum(sum(sum(v) for v in sg["revenue"].values()) for sg in e["segs"].values())
            if tot < min_rev:
                continue
            data = {}
            for seg, sg in e["segs"].items():
                srev = sum(sum(v) for v in sg["revenue"].values())
                sitems = sum(sum(sum(v) for v in mp.values()) for mp in sg["items"].values())
                if srev == 0 and sitems == 0:
                    continue
                data[seg] = {
                    "revenue": rnd(sg["revenue"]), "directCost": rnd(sg["directCost"]),
                    "grossProfit": rnd(sg["grossProfit"]), "opProfit": rnd(sg["opProfit"]),
                    "items": {n: rnd(mp) for n, mp in sg["items"].items()
                              if any(any(a) for a in mp.values())},
                }
            if not data:
                continue
            # 지역: 행 다수결(미지정 제외 우선)
            votes = e["region"]
            real = [(k, v) for k, v in votes.items() if k != "미지정"]
            region = max(real, key=lambda x: x[1])[0] if real else "미지정"
            clff = sorted({clff_of(s) for s in data})
            out[name] = {"region": region, "clff": clff,
                         "segs": list(data.keys()), "data": data}
        return out

    data = {
        "unit": "백만동", "years": YEARS, "costItems": item_names,
        "warehouses": finalize(WH), "customers": finalize(CU, CUST_MIN),
    }
    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
    json.dump(data, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))

    print("창고:", len(data["warehouses"]), "/ 고객사:", len(data["customers"]))
    seg_count = defaultdict(int)
    for e in data["warehouses"].values():
        for s in e["segs"]:
            seg_count[s] += 1
    print("창고 세그먼트 분포:", dict(seg_count))
    for name, e in list(data["warehouses"].items())[:4]:
        print(f"  {name} [{e['region']}] segs={e['segs']} clff={e['clff']}")
    print("OUT:", os.path.abspath(OUT), f"({os.path.getsize(OUT)/1024:.0f} KB)")


if __name__ == "__main__":
    main()
