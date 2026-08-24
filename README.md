# MoveAll

MoveAll은 여러 운동을 루틴화하고, 운동 기록을 공유하며, 전문가가 검수한 안전 지식을
제공하기 위한 Android·iOS·웹 애플리케이션 기반입니다. 현재 이름은 제품명이 확정되기 전의
작업명입니다.

이 저장소는 초기 기능 개발에 바로 사용할 수 있는 모듈형 모놀리식 구조입니다. 개발 환경은
외부 서비스 없이 메모리 저장소로 실행되며, PostgreSQL 전환을 위한 저장소 구현과 초기
마이그레이션도 포함합니다.

## MVP 미리보기

`pnpm dev` 실행 후 웹 또는 Expo 앱에서 최신 MVP를 확인할 수 있습니다. 기본은 화이트
모드이며 내 정보에서 다크 모드로 전환할 수 있습니다.

## 현재 구현 범위

- 이메일 회원가입·로그인과 Argon2id 비밀번호 해싱
- 1시간 만료 HS256 액세스 토큰
- 근력·러닝·등산·다이빙·사이클·수영 종목
- 개인 루틴 생성·조회
- 홈에서 바로 시작하고 항목별로 완료하는 오늘의 루틴
- 내 정보에서 종목·요일을 정하는 루틴 설정
- 운동 세션 기록 API와 수동/웨어러블 데이터 출처 구분
- 실외 지도 기록과 실내 인증샷을 거쳐 스토리 초안으로 이어지는 3단계 기록 화면
- 운동 피드 게시물·댓글
- 6개 종목, 12개 공식 출처 기반 운동 지식 초안
- 지식의 근거·검수 상태와 분리된 상황별 사용자 피드백
- Android·iOS·웹 공용 Expo 앱과 5개 기본 탭
- 화이트·다크 테마와 레퍼런스 기반 오렌지 포인트 색상
- 한눈에 읽는 오늘의 활동 대시보드
- MVP 운동 스토리와 개발용 예시 피드
- 개발·테스트용 메모리 저장소와 PostgreSQL 저장소
- 입력 검증, 공통 오류 응답, 보안 헤더, CORS, 속도 제한, 민감 로그 제거
- 포맷·린트·타입·테스트·웹 빌드·의존성 감사를 수행하는 CI

광고, 결제, 크루 운영, 실시간 채팅, 실제 지도·카메라·웨어러블 SDK 연결, AI 운동 처방은
현재 MVP 기반에 포함하지 않습니다. 기록 화면의 지도와 인증샷은 제품 동선 검증을 위한
상호작용 가능한 미리보기입니다.

## 요구 환경

- Node.js 22.13 이상 25 미만. Node.js 24.19 권장
- pnpm 11.19
- 선택 사항: PostgreSQL

설치:

    pnpm install --frozen-lockfile

## 처음 실행

API 환경 파일을 만듭니다.

PowerShell:

    Copy-Item apps/api/.env.example apps/api/.env
    Copy-Item apps/mobile/.env.example apps/mobile/.env

macOS 또는 Linux:

    cp apps/api/.env.example apps/api/.env
    cp apps/mobile/.env.example apps/mobile/.env

실제 서비스에서는 AUTH_SECRET을 충분히 긴 난수로 교체해야 합니다. 개발 기본값인
DATA_STORE=memory에서는 서버를 다시 시작하면 계정과 기록이 초기화됩니다.

API와 모바일 앱 동시 실행:

    pnpm dev

개별 실행:

    pnpm dev:api
    pnpm dev:mobile

기본 주소:

- API 상태 확인: http://localhost:3000/health
- Expo 개발 서버: 터미널에 표시되는 주소
- 웹: Expo 터미널에서 w 입력

Android 에뮬레이터에서는 모바일 환경 파일의 API 주소를
http://10.0.2.2:3000 으로 변경해야 할 수 있습니다. 실제 기기에서는 개발 PC의 LAN IP를
사용하고 API HOST와 CORS_ORIGINS도 해당 개발 환경에 맞게 제한적으로 설정하세요.

## PostgreSQL 사용

먼저 PostgreSQL 데이터베이스를 준비한 다음 apps/api/.env를 수정합니다.

    DATA_STORE=postgres
    DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/moveall

스키마와 기본 종목 데이터 적용:

    pnpm --filter @moveall/api db:migrate
    pnpm --filter @moveall/api db:seed

마이그레이션은 적용 내역을 schema_migrations 테이블에 기록합니다. 운영 데이터베이스에
적용하기 전에는 반드시 백업과 별도 환경 검증이 필요합니다.

## 품질 검사

전체 검사:

    pnpm check

개별 검사:

    pnpm format:check
    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build
    pnpm audit:dependencies

자동 수정이 필요한 포맷:

    pnpm format

## 프로젝트 구조

    apps/
      api/                 Fastify API, 도메인 로직, 저장소, DB 스크립트
      mobile/              Expo Router 기반 Android·iOS·웹 앱
    packages/
      contracts/           앱과 API가 공유하는 Zod 스키마와 TypeScript 타입
    docs/
      ARCHITECTURE.md      데이터 흐름과 기술 결정
      MILEAGE.md           운동 검증 기반 마일리지 후속 설계
      SAFETY.md            운동 지식·실시간 피드백 안전 정책
    .github/workflows/     커밋과 Pull Request 자동 검사

## 환경 분리

- development: 메모리 저장소 기본, 상세 개발 로그
- test: Fastify 주입 테스트와 독립 메모리 저장소
- production: PostgreSQL과 별도 비밀키 사용, info 수준 구조화 로그

환경 파일은 Git에서 제외되며 예제 파일만 저장소에 포함됩니다. 비밀번호, 토큰,
DATABASE_URL 및 개인정보를 로그에 남기지 마세요.

## API 응답 형식

성공 응답:

    {
      "ok": true,
      "data": {}
    }

실패 응답:

    {
      "ok": false,
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "입력값을 확인해 주세요.",
        "requestId": "request-id"
      }
    }

주요 엔드포인트는 docs/ARCHITECTURE.md에 정리되어 있습니다.

## 중요한 안전 경계

현재 저장된 운동 지식은 모두 DRAFT입니다. 자격과 신원을 확인한 전문가가 출처와 내용을
검수하고 승인한 경우에만 EXPERT_REVIEWED로 전환해야 합니다. 앱은 의료 진단, 치료 또는
개인 맞춤 처방을 제공하지 않습니다. 자세한 기준은 docs/SAFETY.md를 참고하세요.

## 다음 MVP 우선순위

1. 지도 SDK와 카메라 권한을 연결한 실제 경로·사진 기록
2. 전문가 신원 확인, 콘텐츠 버전 승인, 이의 제기 워크플로
3. 신고·차단·관리자 검토가 포함된 커뮤니티 안전 기능

웨어러블 연결과 전문가 지식 추천은 안전·개인정보·플랫폼 권한 설계를 완료한 뒤 진행합니다.
운동 기록 기반 브랜드 할인 마일리지는 `docs/MILEAGE.md`의 검증·원장 정책과 사업 규칙을
확정한 뒤 구현합니다.
