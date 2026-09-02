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
3. Database Settings의 Supabase CA 인증서를 내려받아 `DATABASE_SSL_CA_FILE`에 지정하고 인증서와 호스트 이름을 검증한다.
4. `AUTH_SECRET`은 32자 이상의 별도 난수로 생성해 Secret manager에 저장한다.
5. API 마이그레이션을 실행한 뒤 기본 종목 seed를 적용한다.
6. `pnpm --filter @moveall/api storage:setup`을 실행해 비공개 `groov-media` 버킷을 만들거나 안전하게 갱신한다.
7. project URL과 service-role 키를 API Secret으로 저장한다. service-role 키는 모바일 환경변수나 GitHub에 넣지 않는다.
8. `NODE_ENV=production`, `DATA_STORE=postgres`, `MEDIA_STORAGE=supabase`, `DEV_AUTH_BYPASS=false`를 확인한다.
9. 배포 전 `pnpm --filter @moveall/api production:verify`로 운영 DB, seed, 비공개 버킷, 서명 업로드 URL을 함께 확인한다.
10. `pnpm --filter @moveall/api production:smoke`로 임시 계정의 가입, 세션, 동의, 미디어 게시와 완전 삭제까지 확인한다.

## 휴대폰 푸시 연결

- EAS 프로젝트를 만든 뒤 project UUID를 모바일 빌드의 `EXPO_PUBLIC_EAS_PROJECT_ID`에 넣는다. UUID는 공개 식별자이며 APNs/FCM 비밀키가 아니다.
- Expo Push 보안 토큰을 활성화한 운영 환경은 `EXPO_PUSH_ACCESS_TOKEN`을 API Secret으로만 저장한다.
- iOS APNs와 Android FCM 자격증명은 EAS Credentials 또는 각 개발자 콘솔의 비밀 저장소에서 관리하며 Git과 모바일 환경변수에 넣지 않는다.
- `0010_push_devices.sql` 적용 뒤 앱이 등록한 Expo push token은 사용자별로 PostgreSQL에 저장한다. 팔로우·신고 처리·탭톡 이벤트가 인앱 알림을 만든 뒤 같은 내용을 푸시 발송기에 전달한다.
- 배포 전 실제 iPhone과 Android에서 권한 허용/거부, 포그라운드/백그라운드/종료 상태 수신, 로그아웃 뒤 미수신을 각각 확인한다.

## Secret 분리

| 구분         | 개발                   | 테스트                          | 운영                        |
| ------------ | ---------------------- | ------------------------------- | --------------------------- |
| DB           | 개발 Supabase 프로젝트 | MemoryStore 또는 전용 테스트 DB | 운영 Supabase 프로젝트      |
| AUTH_SECRET  | 개발 전용              | 테스트 전용                     | 운영 전용                   |
| OAuth Client | 개발 redirect          | 테스트 client                   | 운영 Web/iOS/Android client |
| Storage      | 개발 버킷              | 비활성 또는 테스트 버킷         | `groov-media` 비공개 버킷   |
| Push         | 개발 EAS 프로젝트      | 발송기 mock 또는 테스트 기기    | 운영 EAS/APNs/FCM 자격증명  |

실제 값은 `.env` 파일 또는 배포 플랫폼 Secret에만 둔다. 저장소에는 `*.example` 파일만 커밋한다.

## 마이그레이션과 복구

- 모든 스키마 변경은 순번 SQL 파일로 추가하고 `schema_migrations`에 적용 이력을 남긴다.
- 운영 적용 전 개발 프로젝트에서 API 테스트와 마이그레이션을 함께 검증한다.
- 파괴적 변경은 별도 백업과 복구 연습 없이 실행하지 않는다.
- 계정 탈퇴는 Supabase Storage 객체 삭제가 성공한 뒤 PostgreSQL의 사용자 행을 삭제한다. 외래키 `ON DELETE CASCADE`가 계정 소유 데이터를 정리한다.

### 백업·복원·모니터링

- Free 요금제의 DB 자동 백업을 전제로 하지 않는다. `operations:backup`이 `pg_dump` custom format을 만든 뒤 AES-256-GCM으로 암호화하며 평문 dump는 즉시 제거한다.
- `BACKUP_ENCRYPTION_KEY`는 32자 이상으로 Secret에만 저장한다. GitHub Actions의 암호화 artifact는 30일 뒤 순환 삭제한다.
- `operations:restore-test`는 `RESTORE_CONFIRMATION=GROOV_RESTORE_TEST`와 운영 DB가 아닌 별도 `RESTORE_DATABASE_URL`을 요구한다. 월 1회 복원 후 마이그레이션·기본 종목 개수를 확인한다.
- `/health`는 프로세스 생존, `/ready`는 PostgreSQL 연결까지 검사한다. `operations:health`와 15분 GitHub Actions 모니터를 사용한다.
- 예약 워크플로는 기본 비활성이다. 저장소 변수 `GROOV_BACKUP_ENABLED=true`, `GROOV_HEALTH_MONITOR_ENABLED=true`, `GROOV_MEDIA_CLEANUP_ENABLED=true`, `GROOV_API_HEALTH_URL`과 필요한 Secret을 등록한 뒤 활성화한다.
- `storage:cleanup`은 24시간 지난 미완료 업로드와 삭제된 게시물의 고아 미디어를 제거한다. DB 백업에는 Storage 객체가 포함되지 않으므로 미디어 별도 복제 정책은 출시 전 확정한다.

## 출시 전 외부 승인 항목

- Supabase 프로젝트 URL, DB 비밀번호, service-role 키 등록
- Google Web/iOS/Android OAuth Client ID와 redirect/bundle/package/SHA 등록
- Apple Developer·Play Console에 `com.longrun0000.groov` 식별자를 등록하고 서명 인증서를 연결
- Apple HealthKit entitlement와 Android Health Connect 권한 정책 심사
- EAS project 생성, APNs/FCM 자격증명 발급과 Expo Push 보안 토큰 등록
- 개인정보 처리방침의 사업자·연락처·국외 이전 세부 정보 법률 검토
