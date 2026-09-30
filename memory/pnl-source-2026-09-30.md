# Customer PNL 원본 교체 (2026-09-30)

- 원본: https://docs.google.com/spreadsheets/d/1shyoDfEFd9CFlRjD4Nme6InC0-5q6QvTcI9v5iQ2bDQ/edit
- 제목: Integrated Customer PNL_Y26.Aug_2026.09.20
- 입력: Customer PNL Raw 2023~2026. 2023~2025 1~12월, 2026 1~8월 금액 입력됨. 이후 빈 행은 실적에서 제외.
- 사용자 확정: 점 천단위 변환, Direct Profit=직접이익, Gross Profit=매출이익.
- 전 화면 손익 금액은 백만동 기준. 매출·매출원가 표시만 십억동(1000으로 나눔). 환율을 새 원본에 임의 적용하지 않음.
- 경영실적 매출원가=Revenue−Gross Profit, 창고 상세 직접원가는 Direct Cost. 차이를 화면에 설명.
- 2023·2024 지역/Biz2 누락: 미지정 유지. 해당 연도 선택 시 전체 지역 자동 조회. 북부 2025 전년비는 구분 불일치로 제공하지 않음.
- 2023·2024 본사 고객명 #NAME?는 원본 고객명으로 대체. 표기 차이 고객은 임의 병합하지 않음.
- 2024 직접/매출이익 산식 불일치 각각 47행, 2025 각각 314행. 원본 이익값 유지, 실제 사유 확인 필요. 두 숫자는 같은 행일 수 있어 합산하지 말 것.
- 31개 번호 원가 항목(직접/간접/S&A) 포함. 고객 매출 최소금액 제외 규칙 제거.
- 같은 이름의 다지역 엔티티는 지역별 분리하여 북부·남부 합계 섞임 방지.
- 새 사유 저장키 끝에 spreadsheetId 추가. 기존 사유/클라우드 이력은 삭제하지 않음.
- 계획/환율 원본 없음: 목표달성률 숨김. 계약자료는 이전 원본 유지하며 안내 표시.
- 재수집: 구글시트 xlsx 내보내기 후 python3 scripts/import_customer_pnl.py /path/source.xlsx.
- import_customer_pnl.py는 모든 연도·월·6개 지표 창고/고객사 합계를 원본과 검증. pnl_import_quality.json에 출처/기간/품질/합계 저장.
- 실시간 자동 연동은 아직 아님. 가져오기 후 빌드/Hosting 재배포 필요.
