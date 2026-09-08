# GROOV Neighborhood League Lab 2

기존 League Lab 파일을 제거하고 통합 설계안 기준으로 새로 만든 독립 MVP입니다.

- 실행: `node prototypes/league-lab/server.mjs`
- 주소: http://localhost:8093
- 테스트: `node --test prototypes/league-lab/model.test.mjs`

세 안은 규칙이 아니라 첫 화면의 UX 초점이 다릅니다: RANK(개인 순위), LOCAL(운동 커뮤니티), SEASON(자동 호칭과 성장). 공통 구조는 초기 동네 내부 개인 랭킹을 유지하고, 충분한 사용자 데이터가 쌓인 뒤 그 위에 구 단위 지역 리그를 추가합니다.

지역 리그 화면은 실제 행정경계를 사용하지 않는 동일 크기 타일 개념도입니다. 지역 타일의 회원·활성·참여 수는 모두 샘플이며 실제 지역 현황이나 평가가 아닙니다. 실제 주민등록 인구는 표시하거나 보정에 사용하지 않습니다. 프로덕션 보정계수는 GROOV 회원, 기간 내 활성회원, 실제 참여자, 참여율의 분포를 분석한 뒤 결정해야 합니다.

동네 인증, 기록, PB, 랭킹, 사용자, 게시물, 크루는 모두 샘플입니다. 실제 계정·API·DB를 호출하거나 변경하지 않습니다. 상태와 메모는 localStorage `groov-league-lab-v2`에만 저장됩니다. 초기화는 이 키만 덮어씁니다.
