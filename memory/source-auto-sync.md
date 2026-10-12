# 원본 자동 수집 (2026-10-12)

- 사용자 지시: Blaze 요금제 전환은 하지 않는다. 북부앱 Spark 유지.
- 원본 ID: 1shyoDfEFd9CFlRjD4Nme6InC0-5q6QvTcI9v5iQ2bDQ. 현재 XLSX export 읽기 가능. 공유 권한 변경하지 않음.
- 2026-10-12 사용자 변경: 정기 수집 금지. 사용자가 요청할 때만 수집. GitHub cron 제거, workflow_dispatch만 유지.
- scripts/sync_customer_pnl.py → 임시 XLSX → 기존 import_customer_pnl.py의 연/월/6지표 고객·창고 합계 검증 → 빌드 → Hosting만 배포 → JSON 기록 커밋.
- 과거 연도 삭제, 실적 기간 역행, 기존 연도 행수 20% 넘는 감소, 월 공백, 비정상 숫자, 잘못된 헤더는 반영 중지. 산식 불일치는 기존대로 원본값 유지하고 품질 메타에 표시.
- 원본 XLSX는 임시 디렉터리에만 보관하고 실행 종료 시 삭제. 비밀 키나 개인 OAuth 토큰을 저장소에 넣지 않음.
- 배포 인증: Workload Identity Federation, 승인된 main 브랜치의 sync-customer-pnl.yml schedule/workflow_dispatch만 Hosting 전용 계정으로 접근. 프로젝트 Hosting admin + API consumer만 부여. Firestore 사용자 메모 변경 없음.
- public/pnl-sync.json 마지막 확인/실적 갱신 표시. 상태 조회가 실패하면 기존 정상 데이터를 유지하며 확인 필요 표시.
- 코드수정 개발 전 git pull --ff-only로 자동 수집 커밋을 먼저 받는다. 자동수집 배포가 코드를 되돌리지 않도록 앱 변경 후 원격 main에도 반영한다.
- 열린 화면은 기존 새 버전 업데이트 안내로 갱신. 작성 중 메모 보호를 위해 강제 새로고침하지 않는다.
- 원본 시트 이름이 바뀌어도 ID 기준으로 동일 파일을 읽음. Raw 헤더/시트 구조 변경은 검증 오류로 처리.

- 활성화 상태: 2026-10-12 GitHub 로그인 후 워크플로 main 등록 완료. 최초 실행 38213477972 수집·테스트·빌드·WIF 인증·Hosting 배포·원본 커밋 모두 성공. production automationEnabled=true 확인.

- Google 로그인 실패 원인: Firebase Auth 설정 자체가 없었음(CONFIGURATION_NOT_FOUND). firebase.json의 Google provider 설정을 CLI auth 배포로 활성화. 같은 Hosting 도메인 redirect 방식 유지(PWA popup 사용 안 함).
- 로그인 검증 범위: Auth config/provider 200, Google enabled=true, Hosting authorized domain 확인, createAuthUri 200(accounts.google.com). 내장 브라우저 redirect는 network 오류/handler bad-request가 남아 실제 사용자 로그인 완료는 미확인.
