#!/usr/bin/env python3
"""
'1.2 경영계획(26.5, 사업)' 탭 → 당월/누계 계획比·전년비·전월비 (월간 비교용).
출력: src/data/plan_compare.json (단위: 백만원)

컬럼(0-base): 1/2/3=라벨, 당월[전년4·계획5·전월6·실적7], 누계[전년11·계획12·실적13].
"""
import sys, os, json, openpyxl

XLSX = sys.argv[1] if len(sys.argv) > 1 else "/tmp/dashboard.xlsx"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
    os.path.dirname(__file__), "..", "src", "data", "plan_compare.json")

TAB = "1.2 경영계획(26.5, 사업)"
METRICS = ["매출", "영업이익"]              # 헤드라인 지표
LINES = ["베트남CL", "베트남W&D만", "CJ GMD", "베트남법인"]  # 사업 라인


def g(r, i):
    v = r[i] if i < len(r) else None
    return None if v in (None, "") else v


def num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(",", "").strip())
    except ValueError:
        return None


def cells(row):
    return {
        "thisMonth": {"py": num(g(row, 4)), "plan": num(g(row, 5)), "prevMonth": num(g(row, 6)), "act": num(g(row, 7))},
        "ytd": {"py": num(g(row, 11)), "plan": num(g(row, 12)), "act": num(g(row, 13))},
    }


def main():
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    rows = list(wb[TAB].iter_rows(values_only=True))

    # 메트릭 헤더 행 인덱스
    heads = []
    for r, row in enumerate(rows):
        l1 = g(row, 1)
        if l1 in (METRICS + ["법인 판매비", "본사 공통비", "일반관리비"]) and not g(row, 2) and not g(row, 3):
            heads.append((r, l1))
    head_rows = [r for r, _ in heads]

    out = {"unit": "백만원", "monthLabel": "5월", "currentMonth": 5, "metrics": {}}
    for r, name in heads:
        if name not in METRICS:
            continue
        nxt = min([h for h in head_rows if h > r] + [len(rows)])
        total = cells(rows[r])
        lines = []
        for rr in range(r + 1, nxt):
            l2 = g(rows[rr], 2)
            if l2 in LINES:
                lines.append({"name": str(l2), **cells(rows[rr])})
        # 영업이익률(%) 행: 메트릭이 영업이익이면 다음 행 '%'
        margin = None
        if name == "영업이익" and r + 1 < len(rows) and g(rows[r + 1], 1) == "%":
            margin = cells(rows[r + 1])
        out["metrics"][name] = {"total": total, "lines": lines, "margin": margin}

    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
    json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=1)

    for m, d in out["metrics"].items():
        t = d["total"]
        print(f"{m}: 당월 실적={t['thisMonth']['act']} 계획={t['thisMonth']['plan']} 전월={t['thisMonth']['prevMonth']} 전년={t['thisMonth']['py']} | 누계 실적={t['ytd']['act']} 계획={t['ytd']['plan']} | lines={len(d['lines'])}")
    print("OUT:", os.path.abspath(OUT))


if __name__ == "__main__":
    main()
