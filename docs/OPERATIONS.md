# GROOV 운영 환경 기준

## 확정 사항

- 초기 운영 관계형 데이터베이스는 Supabase Free의 PostgreSQL을 사용한다.
- API는 `DATABASE_URL`로만 PostgreSQL에 연결하며 모바일 앱은 데이터베이스에 직접 접근하지 않는다.
- 장기 실행 API는 Supabase Session pooler, 서버리스 API는 Transaction pooler를 사용한다.
- 마이그레이션에는 가능하면 Direct connection을 사용하고, 연결 환경이 IPv4 전용이면 Session pooler를 사용한다.
- 운영 연결은 SSL을 강제하고 Free 요금제의 연결 수를 보호하기 위해 API 풀을 기본 5개로 제한한다.
- 개발, 테스트, 운영은 서로 다른 DB·OAuth 클라이언트·비밀키·미디어 버킷을 사용한다.

## 최초 Supabase 연결 순서

1. Supabase 프로젝트를 만들고 Database의 SSL enforcement를 켠다.
2. Connect 화면에서 실행 환경에 맞는 URI를 복사해 배포 환경의 `DATABASE_URL` Secret으로 저장한다.
3. `AUTH_SECRET`은 32자 이상의 별도 난수로 생성해 Secret manager에 저장한다.
4. API 마이그레이션을 실행한 뒤 기본 종목 seed를 적용한다.
5. Supabase SQL Editor에서 `apps/api/db/supabase/0001_storage.sql`을 한 번 실행해 비공개 `groov-media` 버킷을 만든다.
6. project URL과 service-role 키를 API Secret으로 저장한다. service-role 키는 모바일 환경변수나 GitHub에 넣지 않는다.
7. `NODE_ENV=production`, `DATA_STORE=postgres`, `MEDIA_STORAGE=supabase`, `DEV_AUTH_BYPASS=false`를 확인한다.

## Secret 분리

| 구분         | 개발                   | 테스트                          | 운영                        |
| ------------ | ---------------------- | ------------------------------- | --------------------------- |
| DB           | 개발 Supabase 프로젝트 | MemoryStore 또는 전용 테스트 DB | 운영 Supabase 프로젝트      |
| AUTH_SECRET  | 개발 전용              | 테스트 전용                     | 운영 전용                   |
| OAuth Client | 개발 redirect          | 테스트 client                   | 운영 Web/iOS/Android client |
| Storage      | 개발 버킷              | 비활성 또는 테스트 버킷         | `groov-media` 비공개 버킷   |

실제 값은 `.env` 파일 또는 배포 플랫폼 Secret에만 둔다. 저장소에는 `*.example` 파일만 커밋한다.

## 마이그레이션과 복구

- 모든 스키마 변경은 순번 SQL 파일로 추가하고 `schema_migrations`에 적용 이력을 남긴다.
- 운영 적용 전 개발 프로젝트에서 API 테스트와 마이그레이션을 함께 검증한다.
- 파괴적 변경은 별도 백업과 복구 연습 없이 실행하지 않는다.
- 계정 탈퇴는 Supabase Storage 객체 삭제가 성공한 뒤 PostgreSQL의 사용자 행을 삭제한다. 외래키 `ON DELETE CASCADE`가 계정 소유 데이터를 정리한다.

## 출시 전 외부 승인 항목

- Supabase 프로젝트 URL, DB 비밀번호, service-role 키 등록
- Google Web/iOS/Android OAuth Client ID와 redirect/bundle/package/SHA 등록
- 실제 `com.example.moveall` 식별자를 운영 bundle/package로 교체
- Apple HealthKit entitlement와 Android Health Connect 권한 정책 심사
- 개인정보 처리방침의 사업자·연락처·국외 이전 세부 정보 법률 검토
