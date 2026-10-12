# 원본 자동 수집 (2026-10-12)

- 사용자 지시: Blaze 요금제 전환은 하지 않는다. 북부앱 Spark 유지.
- 원본 ID: 1shyoDfEFd9CFlRjD4Nme6InC0-5q6QvTcI9v5iQ2bDQ. 현재 XLSX export 읽기 가능. 공유 권한 변경하지 않음.
- 공개 저장소 globalistkr-korea/Dash-Board 표준 ubuntu GitHub Actions 사용. 매 3시간 UTC 분17, 베트남 시간 01:17/04:17/07:17/10:17/13:17/16:17/19:17/22:17 예정(플랫폼 지연 가능).
- scripts/sync_customer_pnl.py → 임시 XLSX → 기존 import_customer_pnl.py의 연/월/6지표 고객·창고 합계 검증 → 빌드 → Hosting만 배포 → JSON 기록 커밋.
- 과거 연도 삭제, 실적 기간 역행, 기존 연도 행수 20% 넘는 감소, 월 공백, 비정상 숫자, 잘못된 헤더는 반영 중지. 산식 불일치는 기존대로 원본값 유지하고 품질 메타에 표시.
- 원본 XLSX는 임시 디렉터리에만 보관하고 실행 종료 시 삭제. 비밀 키나 개인 OAuth 토큰을 저장소에 넣지 않음.
- 배포 인증: Workload Identity Federation, 승인된 main 브랜치의 sync-customer-pnl.yml schedule/workflow_dispatch만 Hosting 전용 계정으로 접근. 프로젝트 Hosting admin + API consumer만 부여. Firestore 사용자 메모 변경 없음.
- public/pnl-sync.json 마지막 확인/실적 갱신 표시. 8시간 넘게 확인이 없거나 상태 조회가 실패하면 기존 정상 데이터를 유지하며 확인 필요 표시.
- 코드수정 개발 전 git pull --ff-only로 자동 수집 커밋을 먼저 받는다. 자동수집 배포가 코드를 되돌리지 않도록 앱 변경 후 원격 main에도 반영한다.
- 열린 화면은 기존 새 버전 업데이트 안내로 갱신. 작성 중 메모 보호를 위해 강제 새로고침하지 않는다.
- 원본 시트 이름이 바뀌어도 ID 기준으로 동일 파일을 읽음. Raw 헤더/시트 구조 변경은 검증 오류로 처리.

- 활성화 상태: GitHub 기존 PAT의 workflow 권한 부족으로 등록 대기. 워크플로 최초 GitHub 실행 성공 후 automationEnabled=true가 배포됨. 현재 화면에서는 준비/대기를 구분하며 작동 완료로 표시하지 않는다.
