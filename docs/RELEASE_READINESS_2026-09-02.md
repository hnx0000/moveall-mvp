# GROOV 1–6 운영 전환 보고서

작성일: 2026-09-02

## 결론

Supabase 운영 PostgreSQL과 비공개 Storage는 실제 프로젝트에 연결했고, 임시 계정으로 가입부터 미디어 게시와 완전 삭제까지 운영 스모크 테스트를 통과했다. 앱·API 코드, 마이그레이션, 환경 분리, 정책 초안, Health Connect·HealthKit 어댑터도 빌드와 자동 테스트를 통과했다.

현재 공개 웹 주소는 정적 미리보기 빌드이므로 새 운영 API를 호출하지 않는다. 실제 회원 계정과 영속 기록을 공개 앱에서 사용하려면 Fastify API를 외부 HTTPS 호스트에 배포하고 공개 앱의 `EXPO_PUBLIC_API_URL`을 그 주소로 바꾸는 배포 단계가 남아 있다.

7~12번 출시 준비의 상세 구현·승인 경계는 `docs/RELEASE_PREP_7_12_2026-09-02.md`에 기록했다.

## 항목별 상태

### 1. Supabase PostgreSQL — 운영 인프라 완료, 공개 앱 연결 대기

- Supabase Free `GROOV Production` 프로젝트를 서울 리전에 생성했다.
- Session pooler, SSL 검증, 공식 CA 인증서를 사용하는 운영 연결을 구성했다.
- 8개 마이그레이션과 6개 기본 운동 종목 seed를 실제 운영 DB에 적용했다.
- 서버 전용 RLS 강제·직접 접근 차단(`0009`)과 푸시 기기 테이블(`0010`)은 코드·검증을 완료했으나, 기존 직접 Supabase 접근을 즉시 차단할 수 있어 운영 적용 전 명시 승인을 기다린다.
- `DATA_STORE=postgres`에서 회원, 세션, 동의, 기록, 피드, 미디어 메타데이터가 PostgreSQL에 저장된다.
- 반복 가능한 `db:migrate`, `db:seed`, `production:verify`, `production:smoke` 명령을 마련했다.
- 남은 일: 공개 HTTPS API 호스트 선택 및 배포.

### 2. 인증·계정·보안 — 1차 완료, Android 배포 서명 후속

- 이메일 회원가입·로그인, Argon2 비밀번호 해시, 15분 access token, 30일 회전 refresh session을 구현했다.
- 로그인 기기 목록, 개별 세션 폐기, 비밀번호 변경, 계정과 소유 미디어의 완전 삭제를 구현했다.
- Google ID token의 issuer·audience·서명을 검증하는 서버 경로와 모바일 로그인 화면을 구현했다.
- Google Cloud에 전용 `GROOV Production` 프로젝트를 생성했다.
- Google API 서비스 사용자 데이터 정책에 동의하고, 지원 이메일은 `longrun0000@gmail.com`, 프로젝트 변경·운영 연락처는 `longrun17@naver.com`으로 분리했다.
- 운영 Web OAuth client에 공개 앱 origin과 `/oauthredirect`를 등록하고, iOS client에 `com.longrun0000.groov`를 등록했다.
- Web/iOS client ID를 Git에서 제외된 모바일·API 운영 설정에 연결하고 `longrun0000@gmail.com`을 테스트 사용자로 등록했다.
- 남은 후속: 실제 배포 keystore의 SHA-1을 발급한 뒤 Android OAuth client를 만들고, 스토어 제출 직전 테스트 상태를 프로덕션으로 전환한다.

### 3. 환경변수·Secret 분리 — 완료

- 개발·테스트·운영 예시 설정을 분리했다.
- 실제 `.env`와 Secret은 Git에서 제외한다.
- CI가 포맷, lint, 타입, 테스트, 빌드, 의존성 점검과 하드코딩 Secret 탐지를 수행한다.
- DB 비밀번호, `AUTH_SECRET`, Supabase 서버 전용 키는 로컬 비추적 설정에만 저장했다.
- 공개 앱이나 모바일 번들에는 서버 전용 키를 넣지 않는다.

### 4. 개인정보·약관·동의 — 기능과 초안 완료, 법률 확정 대기

- 회원정보, 운동·건강정보, 위치, 사진·영상, 보관·삭제, 처리 위탁과 국외 이전을 포함한 개인정보 처리방침 초안을 앱에 넣었다.
- 운동 측정 한계, 기록 인증, 커뮤니티, 탈퇴를 포함한 이용약관 초안을 앱에 넣었다.
- 필수 약관 버전·수락 시각과 건강·위치·미디어·마케팅 선택 동의를 PostgreSQL에 각각 저장한다.
- 남은 사용자/전문가 확정: 사업자명·대표자·주소·연락처, 보유 기간, 미성년자 정책, 국외 이전 세부, 위치기반서비스 적용 여부, 법률 검토.

### 5. Health Connect·HealthKit — 코드 완료, 네이티브 승인·기기 검증 대기

- Android Health Connect와 iOS HealthKit의 권한 요청 및 최근 30일 운동 가져오기, GROOV 운동·거리·칼로리 내보내기를 구현했다.
- 운동 시간, 거리, 칼로리, 걸음, 심박, 고도와 종목을 GROOV 기록으로 변환한다.
- 최초 연결 뒤 앱 활성화 시 15분 간격으로 양방향 동기화하고 동일 기록은 건너뛴다.
- 웹에서는 지원 불가를 명시하고, 휴대폰 GPS 실시간 기록과 완료 운동 가져오기를 분리했다.
- 휴대폰 GPS는 승인 시 Android foreground service와 iOS background location으로 화면이 꺼진 동안에도 경로를 버퍼링한다.
- 운영 앱 식별자는 `com.longrun0000.groov`로 정리했다.
- 남은 외부 승인: Apple HealthKit entitlement, Google Play Health apps declaration, 각 스토어 개발자 계정의 앱 식별자·서명 등록.
- 남은 실기 검증: iPhone·Android 실제 기기에서 권한, 양방향 동기화, 백그라운드 GPS, 중복 방지 확인.

### 6. 사진·영상 저장소 — 완료, 공개 API 배포 대기

- Supabase에 비공개 `groov-media` 버킷을 생성했다.
- 서버만 Supabase 비밀 키를 사용해 2시간 업로드 URL과 1시간 열람 URL을 발급한다.
- 피드 작성 화면이 사진을 먼저 업로드한 뒤 미디어 ID를 게시물에 연결한다.
- 계정 탈퇴 시 Storage 파일을 지운 뒤 PostgreSQL 계정을 삭제한다.
- 실제 운영 스모크 테스트에서 업로드, 게시, 서명 열람, 계정 탈퇴와 파일 삭제를 모두 통과했다.
- Cloudflare R2 전환은 사용량과 전송 비용이 커질 때 검토한다.

## 자동·운영 검증 결과

- 포맷 검사: 통과
- lint: 통과
- TypeScript: 통과
- 계약 패키지 테스트: 7개 통과
- API 테스트: 20개 통과
- API·웹 빌드: 통과
- 소스 Secret 검사: 통과
- 운영 DB: 연결 및 마이그레이션 8개 확인, `0009`·`0010` 승인 대기
- 운영 Storage: 비공개 버킷 및 서명 URL 확인
- 운영 전체 스모크: 가입, 세션, 동의, 업로드, 게시, 탈퇴, 파일 삭제 통과

## 사용자가 직접 승인하거나 결정해야 하는 항목

1. Google OAuth 앱을 테스트에서 프로덕션으로 전환할 때 필요한 최종 공개·검증 제출.
2. Apple·Google 개발자 계정에서 앱 식별자, 배포 인증서와 Health 권한 심사.
3. Android 배포 keystore 생성·보관 정책을 확정하고 SHA-1을 Google OAuth에 등록.
4. 개인정보 처리방침과 이용약관의 사업자·연락처·보유 기간·국외 이전·미성년자 정보를 법률 검토 후 확정.
5. Fastify API를 배포할 HTTPS 호스트 선택과 해당 서비스의 계정/요금 승인.

이 항목들은 계정 약관 동의, 법적 책임, 유료 가능성이 있거나 실제 기기·스토어 심사가 필요한 작업이므로 자동 확정하지 않았다.
