# GROOV 아키텍처

## 기술 선택

### Expo와 React Native

모바일이 핵심이면서 웹 제공도 필요하므로 Android, iOS, 웹에서 UI와 도메인 타입을 공유할 수
있는 Expo를 사용합니다. 플랫폼별 네이티브 기능은 어댑터 뒤에 두어 전체 UI가 특정 워치
SDK에 결합되지 않게 합니다.

### Fastify 모듈형 모놀리식 API

초기 제품에는 하나의 배포 단위가 가장 단순합니다. HTTP, 보안, 도메인, 저장소 책임을
폴더로 분리하되 마이크로서비스와 메시지 큐는 도입하지 않습니다.

### PostgreSQL과 메모리 저장소

회원, 루틴, 기록, 게시물, 댓글, 전문가 검수 이력은 관계와 무결성 제약이 중요하므로
PostgreSQL을 운영 저장소로 선택했습니다. 개발과 자동 테스트는 외부 서버 없이 메모리
저장소를 사용할 수 있습니다. 두 구현은 동일한 AppStore 계약을 따릅니다.

### Zod 공유 계약

앱과 API가 같은 입력 스키마와 TypeScript 타입을 사용합니다. API 경계에서 모든 외부 입력을
검증하고 데이터베이스 제약조건을 두 번째 방어선으로 둡니다.

## 요청 데이터 흐름

    Expo 화면
      → API 클라이언트
      → Fastify 경로와 Zod 입력 검증
      → 인증 및 도메인 규칙
      → AppStore 인터페이스
      → MemoryStore 또는 PostgresStore
      → 일관된 성공/실패 응답

UI는 로딩, 빈 결과, 네트워크 오류를 각각 표시합니다. 서버의 내부 오류와 스택은 사용자에게
노출하지 않으며 requestId만 돌려줍니다.

## 주요 API

- GET /health
- POST /v1/auth/register
- POST /v1/auth/login
- POST /v1/auth/google
- POST /v1/auth/development (development 전용)
- GET /v1/auth/me
- GET /v1/auth/providers
- GET /v1/sports
- GET /v1/knowledge/:sport
- POST /v1/knowledge/:articleId/feedback
- GET /v1/routines/me
- POST /v1/routines
- POST /v1/workout-sessions
- GET, PATCH /v1/users/me/profile
- GET /v1/workout-sessions/me
- GET /v1/medals/me
- GET /v1/feed
- POST /v1/posts
- GET /v1/posts/me
- GET /v1/posts/me/archive
- PATCH, DELETE /v1/posts/:postId
- POST, DELETE /v1/posts/:postId/archive
- POST /v1/posts/:postId/comments
- GET /v1/social/me
- POST, DELETE /v1/users/:userId/follow
- DELETE /v1/users/:userId/follower
- POST /v1/users/:userId/block
- GET, POST /v1/messages/:userId

인증이 필요한 요청은 Authorization Bearer 헤더를 사용합니다.

## 데이터 모델

- users: 계정, 비밀번호 해시, 역할, 프로필 사진
- sports: 지원 종목과 안전 수준
- routines: 사용자 루틴, 요일, 순서가 있는 운동 항목
- workout_sessions: 시작·종료, 자각 운동 강도, 측정값, 데이터 출처
- posts: 운동 종목과 선택적 운동 세션이 연결된 게시물·스토리, 보관 상태
- comments: 게시물 피드백
- follows, user_blocks: 팔로워·팔로잉과 차단 관계
- direct_messages: 사용자 간 1:1 메시지
- knowledge_articles: 버전, 출처, 전문가 검수자와 검수 시각
- knowledge_feedback: 지식 콘텐츠와 분리된 사용자 상황·경험 피드백

삭제 전파와 CHECK 제약조건은 초기 마이그레이션에 정의되어 있습니다.

## 인증과 권한

- 비밀번호: Argon2id, 메모리 19 MiB, 반복 2회
- 토큰: HS256, 30일 만료, subject에 사용자 ID만 저장
- Google: 플랫폼 ID 토큰을 서버가 허용된 client ID와 issuer 기준으로 검증
- 개발 자동 로그인: 서버 `NODE_ENV=development`와 앱 `__DEV__`가 모두 참일 때만 사용
- 역할: member, expert, moderator, admin
- 현재 공개 API: 종목, 지식, 피드 조회
- 현재 인증 API: 루틴, 운동 세션, 게시물, 댓글, 지식 상황 피드백 작성

운영 단계에서는 짧은 액세스 토큰과 회전 가능한 refresh token, 세션 폐기, 이메일 확인,
비밀번호 재설정, 감사 이벤트를 추가해야 합니다.

## 확장 지점

- WearableAdapter: Apple Health, Health Connect, Garmin 등
- AppStore: 메모리와 PostgreSQL
- 지식 검수 상태: DRAFT, EXPERT_REVIEWED, RETIRED
- moderation_status: visible, review, hidden

실시간 센서 스트림, 크루, 알림, 광고·커머스는 별도 제품 요구사항과 위협 모델을 만든 뒤
현재 모듈에 추가합니다.
