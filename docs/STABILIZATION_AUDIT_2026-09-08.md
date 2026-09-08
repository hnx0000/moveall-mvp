# GROOV 안정화 — 수정 전 1차 분석 보고

작성일: 2026-09-08. **소스 수정 전 보고서이며 안정화 완료 보고가 아닙니다.**

> 2026-09-09 후속 상태: 안정화 수정본은 메인 프로젝트에 반영했습니다. 이 문서의 `backups/stabilization-20260908` 경로는 당시 조사 이력이며, 이전 백업은 사용자 승인으로 휴지통에 옮겼습니다. 현재 상태는 [안정화 결과](STABILIZATION_PROGRESS_2026-09-08.md)와 [폴더 정리 결과](WORKSPACE_CLEANUP_2026-09-09.md)를 참고하세요.

이번 요청이 도착한 시점에 이 작업에서 진행하던 별도 지도 MVP 수정은 중단했습니다. 다른 작업의 병행 수정은 중단하거나 덮어쓰지 않았습니다. 이후 앱 소스·디자인·DB·배포는 변경하지 않았습니다. 먼저 현재 상태 보존과 읽기 전용 분석, 기존 검사 실행을 진행했습니다. 아래에서 ‘확인’은 코드 경로 확인, ‘모의 재현’은 격리된 메모리 저장소/위치/건강 어댑터 테스트를 뜻하며, 운영 사용자나 실기기 검증을 뜻하지 않습니다.

## 0. 보존·기준선

- 원래 브랜치: `main`, 원래 HEAD: `1d72564d58878769565a08c814a6a1c7f55abe1c`. 기존 미커밋 변경을 보존했습니다.
- 안정화 브랜치: `codex/stabilization-20260908`
- 시작 커밋: `c93cc3c8c81a712d25d26d026f48d614c0d39b43`
- 다른 작업이 같은 작업 폴더의 독립 지도 MVP를 수정 중이므로, 공유 폴더의 `main`/기존 index를 전환하지 않고 별도 index로 앱 기준선 커밋을 생성했습니다. 이 커밋에 핵심 앱·API·계약·설정·문서를 포함했고, 변경 중인 독립 지도와 대용량 자료는 파일 백업으로 따로 보존했습니다.
- 검사 종료 후 앱/API/계약/스크립트/배포 설정/패키지 파일을 시작 커밋과 비교한 결과 차이가 없었습니다. 분석 문서·검사 기록과 빌드 산출물만 새로 생성했습니다.
- 파일 백업은 `backups/stabilization-20260908`에 보관했습니다. **정확 파일 아카이브 + supplement + manifest를 한 세트로** 사용해야 합니다. 72,209개 일반 파일의 포함 여부와 대표 소스·설정 226개의 복원 후 해시를 확인했습니다. 링크 2,489개의 원래 대상을 별도로 기록했습니다.
- 지도 MVP 6개 파일은 백업 도중 다른 작업에서 바뀌어 이전/이후 버전을 함께 보관했습니다. 그러므로 이 전체 폴더 백업은 단일 순간의 원자적 스냅샷이 아닙니다. **외부 DB·Storage·브라우저 메모리까지 백업됐다는 의미도 아닙니다.**
- 백업에는 비공개 환경설정이 포함되어 접근 권한을 제한했습니다. 저장소 업로드·공유 대상이 아닙니다. 복원은 원본 폴더를 덮어쓰지 않고 새 폴더에서 진행해야 합니다.

### 기존 검사 결과 — 2026-09-08 20:42~20:44 KST

| 검사                                                               | 결과                                                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 공통 계약 빌드 / API·모바일 타입 검사                              | 통과                                                                                         |
| 공통 계약 테스트                                                   | 29개 통과                                                                                    |
| API 테스트                                                         | 57개 통과                                                                                    |
| 모바일 기존 테스트                                                 | 110개 통과                                                                                   |
| API 빌드 / Expo 웹 빌드                                            | 통과, 웹 정적 경로 42개 생성                                                                 |
| 전체 lint                                                          | **실패: 오류 270개**. 모바일 앱 15개/4파일, 독립 prototype 255개                             |
| 전체 서식 검사                                                     | **실패: 95개 파일**. 앱 21개, prototype 65개, 참고 자료 7개, scripts 2개. 자동 수정하지 않음 |
| 기존 소스 Secret 패턴 검사                                         | 통과. 모든 보안 문제·실제 배포 노출이 없다는 증명은 아님                                     |
| 실기기 GPS·잠금·강제 종료 / 운영 DB·Storage / 전체 실제 로그인 E2E | 아직 미검증                                                                                  |

검사 로그는 같은 백업 폴더의 `direct-checks.json`과 `direct-*.log`에 보관했습니다. 기존 모바일 테스트에는 소스 문자열 검사도 있으므로 **196개 통과를 196개 실제 사용자 시나리오 통과로 해석하지 않습니다.**

앱 lint 15개는 `reward-collection.tsx` 11개(정적 이미지 require 규칙 10개·미사용 변수 1개), `record-studio.tsx` 미사용 인자 2개, `league-map-preview.tsx` 미사용 인자 1개, `groov-city-heat-lab.web.tsx` 미사용 import 1개입니다. prototype 오류 중 242개는 브라우저/Node 전역 변수에 대한 `no-undef`입니다. 따라서 **270개를 실제 실행 결함 270개로 해석하지 않습니다.** API·contracts·site 오류는 이 검사 로그에 없습니다.

웹 산출물의 표시 크기는 메인 JS 5.6 MB, MapLibre JS 1.1 MB, Leaflet JS 149 KB였습니다. 이는 압축 전 산출물 크기이며 실제 최초 다운로드량·프레임·메모리·네트워크 응답 지연을 측정한 값은 아닙니다.

검사 도중 패키지 매니저가 자동 의존성 재구성을 시작해 즉시 중지했습니다. 백업에서 의존성 파일과 링크 2,481개를 복구했고, 의존성 일반 파일 67,177개의 존재·크기 일치를 확인했습니다. 이후 설치 명령 없이 기존 검사 도구를 직접 실행해 위 결과를 얻었습니다. 패키지 버전·lockfile·앱 소스는 변경하지 않았습니다.

## 1. 현재 프로젝트 구조 요약

현재 구조는 **Expo 앱 + 별도 Fastify API + 공통 계약 패키지**입니다. 정적 웹을 배포하는 Worker와 실험용 지도는 별도 실행 경로입니다.

| 영역                             | 실제 구조와 역할                                                                           | 주의점                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `apps/mobile/app`                | Expo Router의 route/layout 파일 38개. 5개 탭, 로그인·온보딩·프로필 하위 화면·편집기·실험실 | 화면 진입 게이트가 전체 Stack을 교체함        |
| `apps/mobile/src`                | 소스 파일 85개. 화면, 공통 UI, auth, API, GPS, 건강, 미디어, 지도                          | 서버 데이터가 화면별 state에 분산             |
| `apps/api/src`                   | 파일 18개. Fastify 라우트, Store 계약, Memory/Postgres 구현, 인증·미디어·푸시              | 하나의 `app.ts`에 인증부터 게시·관리까지 집중 |
| `packages/contracts/src`         | 파일 7개. Zod 입력 계약, 공개 타입, 공개 범위, 리그 계산, 사용자 유형, 데모 캐릭터         | 출력 대부분은 TS 타입으로만 검사              |
| `apps/api/db/migrations`         | SQL 마이그레이션, FK·인덱스·서버 전용 RLS                                                  | SQL 파일 존재와 운영 DB 적용 여부는 별개      |
| `site/worker.mjs`                | 정적 파일과 SPA fallback                                                                   | Fastify 실행·DB 연결 기능 없음                |
| `prototypes/groov-korea-25d-map` | 메인 앱과 분리된 지도·코스 실험                                                            | 전국 점수는 시뮬레이션, 코스는 해당 PC 저장   |
| `dashboard`, `docs`, 루트 HTML   | 개발·제품 검증 문서와 대시보드                                                             | 실제 운영 완료 상태와 혼동하면 안 됨          |

149개 주요 코드 파일의 구조를 집계했습니다. 가장 큰 파일은 피드 2,798줄, 운동 기록기 2,531줄, 데모 API 2,008줄, 활동 화면 1,982줄, 콘텐츠 편집기 1,890줄, PostgreSQL Store 1,822줄입니다. 단순히 길다는 이유로 재작성하지 않습니다. 상태 경계와 실패 처리부터 좁혀야 합니다.

상대 import/export 정적 그래프에서 2개 순환 경로가 잡혔지만 확인한 역방향 참조는 `import type`입니다. 이를 런타임 순환 의존성 버그라고 단정하지 않습니다. 동적 import·플랫폼별 해석까지 완전 증명한 검사는 아닙니다. 조사한 핵심 소스에서 TODO/FIXME 표식은 없었지만, 그것이 미완성 기능이 없다는 뜻은 아닙니다.

## 2. 주요 기능 연결 구조

일반 경로: **입력 → 화면/컴포넌트 state → API client → Fastify 검증·권한 → Store → PostgreSQL → 응답 가공 → 화면별 재조회/낙관 갱신**.

미리보기 경로는 API client에서 `demoApi`로 갈라져 로컬 메모리·브라우저 저장소를 사용합니다. 현재 실제 선택 기준은 `EXPO_PUBLIC_LOGIN_REQUIRED === "true"`이고, `EXPO_PUBLIC_DEMO_MODE`가 아닙니다. 확인한 로컬 모바일 환경 파일에는 LOGIN_REQUIRED 설정이 없습니다. 따라서 해당 환경 파일 기준은 demo 경로입니다. 실행 프로세스 환경과 이미 배포된 번들 설정은 별도 검증이 필요합니다.

### 기능별 의존성 표

| 기능                         | 시작·state / 서비스                                            | API                                                                     | 실제 저장·연결 영향                                                               |
| ---------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 회원가입·이메일 로그인       | Login → AuthProvider/session                                   | `/v1/auth/register`, `/login`                                           | `users`, `auth_sessions`; 전체 화면 권한                                          |
| 소셜 로그인                  | Login → OAuth/identity verifier                                | `/v1/auth/google`, `/apple`, `/kakao`, `/naver`                         | `oauth_identities`, `users`, `auth_sessions`                                      |
| 복원·갱신·로그아웃           | AuthProvider, SecureStore/native·localStorage/web              | `/auth/me`, `/refresh`, `/logout`                                       | `auth_sessions`; navigator·업로드·GPS·푸시 모두 영향                              |
| 프로필·온보딩·동의           | 프로필/온보딩 화면별 state, AuthProvider                       | `/users/me/profile`, `/onboarding`, `/consents/me`                      | `users`, `user_onboarding`, `user_consents`; 프사·피드·리그                       |
| 팔로우·팔로잉·팔로워         | 연결 화면/피드/member state                                    | `/users/:id/follow`, `/follower`, `/connections`, `/social/me`          | `follows`; 공개 범위·공유 대상·알림                                               |
| 루틴 생성·수정·정렬·삭제     | Activity/Profile routine state                                 | `/routines`, `/routines/me`, `/routines/order`, `/routines/:id`         | `routines`; 오늘 루틴·운동 기본 설정                                              |
| 운동 시작·측정·일시정지·재개 | Activity → LiveWorkoutRecorder의 phase/ref/timer               | 측정 중 서버 호출이 아닌 기기 수집 중심                                 | 메모리 state와 background buffer; 지도·거리·시간                                  |
| GPS·위치 권한                | expo-location → foreground watcher/background task → gps-track | 기기 OS 권한                                                            | AsyncStorage buffer, 현재 route points; 종료 저장에 연결                          |
| 운동 종료·저장               | Recorder.persistWorkout → api.createWorkoutSession             | `POST /workout-sessions`                                                | `workout_sessions`; 적격 기록은 같은 트랜잭션의 `league_workout_points`           |
| 운동 수정·삭제               | 활동/프로필 기록 화면 state                                    | `PATCH/DELETE /workout-sessions/:id`                                    | 기록·리그 포인트·게시 연결·메달 계산 영향                                         |
| 지도·루트·확대/회전          | workout-map(.web), map model, route points                     | 지도 타일/경로 제공자                                                   | route는 `workout_sessions.route_points`; 별도 routeId 테이블 아님                 |
| 워치 완료 기록 동기화        | HealthAutoSync → health-sync → native adapter                  | 운동 목록/생성 API                                                      | 건강 앱 ↔ `workout_sessions`; 실시간 생체 데이터 수신은 미구현                    |
| 게시 작성·사진·영상          | ContentEditor/RecordStudio state → media/upload                | `/media/upload-ticket` → Storage PUT → `/media/:id/complete` → `/posts` | `media_objects`, Storage 객체, `posts`; 여러 독립 요청                            |
| 지도/운동기록 게시           | 편집기 레이어 → artwork/export → createPost                    | `/posts` + 선택한 `workoutSessionId`                                    | `posts.workout_session_id`, `media_id`; 기록과 공유 카드                          |
| 피드 조회                    | FeedScreen + useAsyncData                                      | `/feed`, `/posts/:id`, `/users/:id/posts`                               | posts·작성자·댓글·좋아요·공개범위·미디어 URL 조합                                 |
| 좋아요                       | feed-like-surface/gesture + 요청 방어 ref                      | 게시물 좋아요 PUT/DELETE                                                | `post_likes`, 집계값·알림                                                         |
| 댓글·대댓글·댓글 좋아요      | PostComments → comment model                                   | 게시물 comments 및 comments 좋아요 API                                  | `comments`, `comment_likes`; 부모 댓글 FK                                         |
| 언급                         | comment-mentions → 댓글 payload                                | 댓글 작성 API                                                           | 댓글 내용/언급 대상 + notifications; 별도 mentionId 없음                          |
| 공유·탭톡                    | TapShareSheet/메시지 화면 state                                | `/posts/:id/share`, `/messages/:userId`                                 | `post_shares`, `direct_messages`; 대상 권한·알림                                  |
| 알림·푸시                    | NotificationBell/PushRegistration                              | `/notifications`, `/push-device`, `/:id/read`                           | `notifications`, `push_devices`, Expo Push                                        |
| 크루                         | audience picker의 작성자 소유 수신자 그룹                      | `/sharing-crews`                                                        | `sharing_crews`; 완전한 크루 운영 시스템과는 다름                                 |
| 리그·포인트                  | Knowledge/LeagueRegion → 주기적 재조회                         | `/league`                                                               | `user_onboarding` 지역 + `league_workout_points` 집계; WebSocket이 아닌 polling   |
| 메달·개인 성취               | 프로필/reward collection                                       | `/medals/me` + 로컬 목표                                                | 운동에서 계산하는 메달; 개인 목표는 일부 localStorage 전용                        |
| 챌린지                       | 화면·카피와 실제 서버 도메인 구분 필요                         | 독립 challenge API 확인 못함                                            | 독립 challengeId/참여 테이블 확인 못함; 완성으로 표시 금지                        |
| 신고·차단·관리               | moderation/privacy 화면 → 서버 권한                            | `/reports`, `/block`, `/restriction`, `/admin/reports`                  | `content_reports`, `user_blocks`, `user_restrictions`; 피드·댓글·메시지 권한 영향 |

### 상태와 ID 계약

- Auth/Theme은 Context, 서버 조회는 화면별 state/useAsyncData, 운동·편집은 컴포넌트 내부 state/ref입니다. 전역 server-state cache는 확인되지 않았습니다.
- `useAsyncData`에는 오래된 조회가 새 mutation을 덮지 않도록 요청 버전 방어가 있습니다. 모든 화면의 직접 loader가 이 방어를 사용하는 것은 아닙니다.
- 실제 DB의 user/workout/post/comment/crew/notification ID는 UUID이며 API는 문자열입니다. 데모의 `demo-*`, `goal-*` ID와 혼용하면 실제 UUID API에서 거절될 수 있습니다. 이것은 자동 변환 대상이 아니라 실행 경로 분리 대상입니다.
- profile은 별도 profileId가 아니라 users.id 기반입니다. route는 workout의 JSONB 좌표이며 별도 routeId가 없습니다. league는 지역·기간 집계이고 일반적인 leagueId CRUD가 아닙니다. medalId는 카탈로그/계산 식별자입니다. 없는 ID를 임의로 새 DB 테이블로 만들지 않습니다.
- DB snake_case ↔ API camelCase 매핑, timestamp의 ISO 변환, KST 리그 기간 계산이 존재합니다. 다만 응답을 `as ApiSuccess<T>`로 단언해 런타임 전체 검증을 하지 않습니다. `metrics`는 종목별 엄격한 단위 계약이 아닌 `Record<string, number>`입니다.
- 삭제 CASCADE/SET NULL, 소유자 검사, 좋아요 PUT/DELETE와 공유 중복 방어 등 기존 안전장치는 보존합니다. SQL 마이그레이션의 번호 중복(0010/0011)은 이름 전체를 저장하는 runner 구조상 곧바로 충돌이라고 판단하지 않습니다.

## 3. 가장 위험한 문제 TOP 10

| ID / 등급       | 문제·근거                                                                                                                         | 확인 범위·영향                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| R01 CRITICAL    | 미인증 이메일 가입 즉시 세션 발급 + 이메일 문자열로 관리자 판정. `app.ts:175,385`                                                 | 가상의 미등록 관리자 이메일 가입 후 관리자 API 200 모의 재현. 운영 관리자 계정 상태 미확인. 권한 탈취 조건 존재      |
| R02 CRITICAL    | 비밀번호 선가입 계정에 같은 이메일의 OAuth를 자동 연결하고 기존 비밀번호·세션 유지. `postgres-store.ts:350`                       | 가상 Google identity로 기존 계정 ID 연결, 원래 비밀번호/세션 접근 유지 모의 재현. 계정 선점 문제                     |
| R03 CRITICAL    | accessToken이 바뀔 때 온보딩 pending → Stack 제거. `auth-context.tsx:77,163`, `_layout.tsx:89`                                    | 정상 갱신 약 14분마다 화면 unmount 경로 확인. 편집 초안 손실·운동 추적 중지 위험                                     |
| R04 CRITICAL    | foreground 최신 좌표 뒤에 이전 background 좌표를 append하여 stale로 전부 거절. `live-workout-recorder.tsx:220`, `gps-track.ts:97` | 모의 재현: 시간순 13점/104.95m가 역순 복귀 시 2점/0m. 기기별 실제 빈도는 미검증                                      |
| R05 CRITICAL    | 건강 동기화 동의·상태 키가 계정별이 아닌 기기 공통. `health-sync.ts:7`, `health-auto-sync.tsx:13`                                 | A에서 동의 후 B 로그인 시 같은 건강 운동이 B로도 업로드되는 모의 재현. 건강정보 계정 경계 위반                       |
| R06 HIGH        | GPS 시작 대기 중 닫아도 비동기 응답이 나중에 watcher/background task 생성. `live-workout-recorder.tsx:312,334`                    | unmount 후 watcher 1개·background 시작 모의 재현. 숨은 추적·배터리·상태 꼬임                                         |
| R07 HIGH        | 세션 폐기 후 폐기된 토큰으로 푸시 등록 해제하고 실패 무시. `auth-context.tsx:190`, `push-registration.tsx:60`                     | 서버 권한 경로상 unregister 실패 확인. 로그아웃 기기에 이전 계정 알림 전달 가능                                      |
| R08 HIGH        | refresh token rotation이 이전 hash 비교 없이 session ID로 갱신. `app.ts:515`, `postgres-store.ts:441`                             | 같은 토큰 동시 요청 둘 다 200·다른 새 토큰 발급 모의 재현. 나중 응답/DB 순서에 따라 다음 갱신 실패                   |
| R09 HIGH        | 빌드·문서의 DEMO_MODE와 실제 LOGIN_REQUIRED 분기 불일치. `build-site.mjs:12`, `client.ts:409`                                     | 로컬 환경에서 데모 선택이 기본. 정적 Worker는 API/DB를 실행하지 않음. ‘동작함’이 실제 영속 저장 검증으로 오인될 위험 |
| R10 HIGH·조건부 | 새 sharing_crews 테이블에 RLS/revoke 누락. `0011_post_audiences.sql:5`                                                            | 마이그레이션 누락 확인. 실제 노출은 배포 DB grants·Data API 설정 확인 필요. 노출됐다면 사적 수신자 그룹 접근 가능    |

보안 재현은 운영이 아닌 격리 Fastify/MemoryStore와 가상 이메일·identity를 사용했습니다. 기존 컴파일된 API에 대한 재현이며 해당 소스 경로도 대조했습니다. PostgreSQL 실제 인스턴스에 대한 공격 재현은 하지 않았습니다.

### 추가 발견 / 다음 검사 대상

| ID / 등급       | 내용                                                                                       | 근거                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| R11 HIGH        | 게시 INSERT 후 URL 가공/응답 실패 → 재시도 시 업로드·게시 중복. 작업 멱등키/단계 재개 없음 | `content-editor.tsx:526`, `app.ts:908,916`, `media-storage.ts:135`                   |
| R12 HIGH        | 일시적인 네트워크/5xx도 인증 정보 삭제로 처리                                              | `auth-context.tsx:103,164`                                                           |
| R13 HIGH        | 실내 수영도 GPS 필수로 시작하며 랩을 GPS 거리로만 계산                                     | `live-workout-recorder.tsx:423,518`; 타이머 시작·수영장 랩 실패                      |
| R14 MEDIUM      | 건강에서 가져온 기록 삭제 후 다음 동기화에 다시 생성                                       | `health-sync.ts:125`; 삭제 tombstone/provider ID 없음, 모의 재현                     |
| R15 MEDIUM      | 열린 탭톡에 상대방 신규 메시지 갱신 경로 없음                                              | `profile/message.tsx:31,40,50`; 화면 복귀 시만 재조회                                |
| R16 MEDIUM      | 공통 API에 앱 수준 timeout/취소·오류별 재시도·401 갱신 연동이 없음                         | `api/client.ts:77`; 브라우저 자체 timeout과 별개                                     |
| R17 MEDIUM      | 피드 100개 선조회 후 건별 공개범위/팔로우/좋아요 SQL 추가. 가시성 필터 전에 LIMIT          | `postgres-store.ts:873,914`; N+1 구조와 빈 페이지 가능, 실제 query 수/지연 측정 필요 |
| R18 HIGH·플랫폼 | 개인 목표 저장이 globalThis.localStorage 전용                                              | `goals.ts:23,44`; native에서는 쓰기가 무시될 수 있음. native 재실행 검증 필요        |
| R19 LOW         | 거대 파일·여러 편집기 경로·화면별 서버 state 중복                                          | 기능별 책임 분리 후보. 참조된 실험실을 ‘죽은 코드’라며 삭제하지 않음                 |

## 4. 안정화 우선순위와 문제별 수정 계획

현재 보존 상태는 ‘안정 버전’ 인증이 아니라 **되돌아갈 수 있는 시작 기준선**입니다. CRITICAL → HIGH → MEDIUM → LOW 순서를 지키되, 운영 연결 여부 확인은 모든 검증의 선행 조건입니다.

| 묶음 / 문제                 | 최소 수정 방향                                                                                           | 예상 위험                                        | 통과해야 하는 테스트                                                                        | 롤백                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| P0 검증 경로 R09            | demo/live 모드를 한 곳에서 명시, 서버·DB 대상 식별과 테스트 데이터 분리                                  | 잘못 전환하면 기존 로컬 데모 기록 혼동           | 동일 사용자 새 기기/재로그인 영속성, demo→실제 ID 혼입 방지                                 | 환경 전환 전 값 보존·기존 모드 복귀                                            |
| P1 계정 보호 R01/R02/R10    | 검증된 계정 ID/role로 관리자 지정, 명시적 소유권 확인/계정 연결, 누락 RLS를 새 소규모 migration으로 보강 | 실제 관리자 잠김·잘못된 계정 병합                | 예약 이메일 가입 금지/권한 거절, 선가입→OAuth 공격 시나리오, anon/auth DB 접근 거절         | 코드 단일 커밋 revert; DB 정책 이전 정의 백업. 계정 합치기/삭제 자동 수행 금지 |
| P2 데이터 손실 R03/R04/R05  | 동일 사용자 token 갱신은 navigator 유지; GPS는 타임스탬프 순 병합; 건강 동의/작업/캐시는 userId 격리     | 온보딩 우회·중복 거리·타 계정 건강 데이터 재사용 | 15분 넘긴 기록/편집, foreground 선도착, A→B 계정 전환과 재동의                              | 각 문제 독립 커밋; 이전 구현 보존; persisted 키는 비파괴 migration             |
| P3 수명주기 R06/R07/R08/R12 | 비동기 GPS 세대 토큰과 정리; logout에서 푸시 해제 보장; refresh 원자적 CAS; 일시 오류와 인증 만료 구분   | 숨은 listener·알림 중복·세션 갱신 잠김           | 지연 권한 후 닫기, pause/stop 중 응답, logout 후 알림, 동일 refresh 동시 요청, offline 복귀 | 기능별 checkpoint revert; 등록/해제 정책 재검증                                |
| P4 저장·기기 R11/R13/R18    | 게시 작업 ID·업로드 재사용/재개, 실내 수영 GPS 분리, 목표 userId별 native 저장 adapter                   | 중복 억제 오판·기존 목표 누락                    | 저장 직후 응답 차단/재시도, 실내 권한 거절, 앱 재실행 후 목표                               | 기존 저장 구조 유지하는 adapter; 원본/신규값 동시 보존                         |
| P5 정합성 R14/R15/R16/R17   | 원본 기록 ID+삭제 표식, 대화 갱신 정책, bounded timeout/retry, query batching/가시성 pagination          | 삭제 복구 정책·과도한 polling·순서 변경          | 강제 건강 재동기화, 수신 중 열린 화면, timeout/중복 요청, 사용자별 비공개 피드              | 각 변경 단독 revert, 성능/정합성 이전 결과와 비교                              |
| P6 책임 분리 R19            | 인증·측정 엔진·업로드 작업·표시 UI를 경계별로 천천히 분리                                                | 외형/기능 회귀                                   | 동일 입력과 mock 시간에 이전/새 구현 결과 비교 + 시각 비교                                  | 기존 구현 삭제 없이 별도 모듈로 병행 후 교체                                   |

## 5. 실제 코드 수정 전에 진행할 작업 계획

1. 백업과 Git 기준선을 검증하고 기존 빌드·타입·린트·테스트 결과를 기록합니다. 실패가 있으면 기존 실패로 분리하며 무단 자동 수정하지 않습니다.
2. 이 보고서의 확인된 문제부터 독립된 실패 재현 테스트로 고정합니다. 동작 테스트와 단순 소스 문자열 검사·모의 DB 테스트를 구분합니다.
3. 격리 PostgreSQL에 전체 migration을 적용해 실제 스키마, FK, RLS/grants, 트랜잭션, 동시 refresh를 확인합니다. 운영 migration/운영 데이터 변경은 아직 하지 않습니다.
4. 실제 인증 경로의 앱 E2E를 위한 가상 사용자/테스트 DB/스토리지를 준비합니다. 운영 이메일·건강정보·운동기록은 테스트 데이터로 사용하지 않습니다.
5. Android/iOS 실기기 검증이 필요한 항목과 계정/권한 승인이 필요한 항목을 분리합니다. Web에서 통과했다고 화면 잠금·OS 강제 종료·HealthKit을 통과 처리하지 않습니다.
6. 보고서 검토 이후 각 문제를 **실패 재현 → 최소 수정 → build/lint/type/unit → 연결 기능 회귀 → checkpoint**로 처리합니다. 통과 전 다음 문제와 섞지 않습니다.

### 회귀 테스트 시나리오

| 시나리오                                                                                                       | 필수 합격 조건                                        | 현재 위치                                |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------- |
| 가입 → 로그인 → 프로필 → 운동 → 종료 저장 → 기록 → 사진 게시 → 좋아요·댓글·팔로우 → 알림 → 로그아웃 → 재로그인 | 같은 계정의 DB 기록과 화면이 일치, 중복·유실 없음     | 전체 live E2E 미실행                     |
| 운동/편집 중 토큰 2회 갱신                                                                                     | 기록기/초안/Stack 유지, watcher 하나                  | 결함 경로 확인                           |
| background 60초 뒤 foreground 최신 fix가 먼저 도착                                                             | 모든 유효한 점을 시간순 병합, 거리·pause break 보존   | 실패 모의 재현                           |
| GPS 권한 지연 → 닫기/일시정지/종료                                                                             | 늦은 응답이 watcher/task를 재생성하지 않음            | 실패 모의 재현                           |
| 네트워크 없음·느림·timeout·5xx → 복귀                                                                          | 세션/초안 보존, 명확한 실패/재시도, 중복 저장 없음    | 통합 E2E 필요                            |
| 이미지/영상 업로드 각 단계 실패·화면 이탈·재시도                                                               | orphan 회수, 완료 객체 재사용, 게시 멱등성, 취소 가능 | 부분 실패 결함 확인                      |
| A 건강 동기화 → 로그아웃 → B 로그인                                                                            | B의 별도 동의 전 업로드·내보내기 없음                 | 실패 모의 재현                           |
| 로그아웃 → 이전 화면 뒤로가기·푸시 수신                                                                        | 개인 화면 접근 차단, 이전 계정 알림 해제              | 권한/해제 순서 결함 확인                 |
| GPS·카메라·사진 권한 거부와 location service OFF                                                               | 관련 기능만 차단, 다른 기록 기능은 사용 가능          | 실내 수영 분기 결함 확인; 기기 검사 필요 |
| 앱 강제 종료·재실행·잠금·장시간 운동                                                                           | 복구 가능한 운동 상태, OS 제한을 정직하게 안내        | 실기기 미검증                            |
| 빈/null/잘못된 UUID·오래된 cache·저장 연타                                                                     | 계약 거절·empty/error UI, 중복 mutation 없음          | 일부 unit 방어만 확인                    |
| 지도+피드, 대량 댓글·사진                                                                                      | 프레임/메모리/리스너/요청/SQL 수 기준 수립 후 비교    | 실제 성능 수치 미측정                    |

### 코드 확인 지점

아래 링크는 이 PC의 실제 소스입니다. 표의 파일명·행 번호와 함께 확인할 수 있습니다.

- 인증·권한: [API 라우트](C:/Users/longr/OneDrive/문서/앱개발/apps/api/src/app.ts:175), [PostgreSQL 계정 연결](C:/Users/longr/OneDrive/문서/앱개발/apps/api/src/infrastructure/postgres-store.ts:350), [모바일 세션](C:/Users/longr/OneDrive/문서/앱개발/apps/mobile/src/auth/auth-context.tsx:77), [화면 진입 게이트](C:/Users/longr/OneDrive/문서/앱개발/apps/mobile/app/_layout.tsx:89)
- GPS·건강: [운동 기록기](C:/Users/longr/OneDrive/문서/앱개발/apps/mobile/src/components/live-workout-recorder.tsx:220), [GPS 필터](C:/Users/longr/OneDrive/문서/앱개발/apps/mobile/src/features/location/gps-track.ts:97), [건강 동기화](C:/Users/longr/OneDrive/문서/앱개발/apps/mobile/src/features/wearables/health-sync.ts:7)
- 게시·실행 모드: [콘텐츠 편집기](C:/Users/longr/OneDrive/문서/앱개발/apps/mobile/src/components/content-editor.tsx:526), [API 클라이언트](C:/Users/longr/OneDrive/문서/앱개발/apps/mobile/src/api/client.ts:409)

### 완료 판정

현재는 **CRITICAL/HIGH가 남아 있으므로 안정화 완료가 아닙니다.** 기존 테스트 통과만으로 위 결함이 해결됐다고 판단하지 않습니다. 실제 PostgreSQL·Storage·OAuth 설정, 실기기 background/GPS/health, 배포 번들의 실행 모드는 별도 확인이 필요합니다. 본 보고서 이후에도 디자인 임의 변경, 전체 rewrite, 패키지 일괄 교체, 정상 기능 삭제는 하지 않습니다.
