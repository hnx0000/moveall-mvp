import { api, apiBaseUrl } from "../api/client";
import { requestPedestrianRoute } from "../services/route-planner";

export type DiagnosticState = "running" | "pass" | "fail" | "blocked";

export type DiagnosticResult = {
  id: string;
  area: string;
  label: string;
  state: DiagnosticState;
  detail: string;
  durationMs: number;
};

type DiagnosticContext = {
  token: string | null;
  appOrigin: string | null;
};

type DiagnosticCheck = {
  id: string;
  area: string;
  label: string;
  run(context: DiagnosticContext): Promise<string>;
};

const appRoutes = [
  ["page-home", "홈", "/"],
  ["page-feed", "피드", "/community"],
  ["page-record", "운동 기록", "/routines"],
  ["page-knowledge", "바이블", "/knowledge"],
  ["page-profile", "내 정보", "/profile"],
  ["page-profile-records", "내 기록", "/profile/records"],
  ["page-profile-followers", "팔로워 관리", "/profile/followers"],
  ["page-profile-content", "콘텐츠 관리", "/profile/content"],
  ["page-profile-archive", "콘텐츠 보관함", "/profile/archive"],
] as const;

const checks: DiagnosticCheck[] = [
  {
    id: "api-health",
    area: "서버",
    label: "API health check",
    run: async () => {
      const response = await fetch(`${apiBaseUrl}/health`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as {
        ok?: boolean;
        data?: { service?: string; status?: string };
      };
      if (!payload.ok || payload.data?.status !== "ok") throw new Error("상태 응답 형식 오류");
      return `${payload.data.service ?? "groov-api"} 정상`;
    },
  },
  {
    id: "sports",
    area: "홈",
    label: "운동 종목 API",
    run: async () => {
      const sports = await api.sports();
      if (sports.length < 6) throw new Error(`종목 ${sports.length}개만 반환`);
      return `${sports.length}개 종목 반환`;
    },
  },
  {
    id: "feed",
    area: "피드",
    label: "공개 피드 조회",
    run: async () => {
      const posts = await api.feed();
      return `${posts.length}개 게시물 반환`;
    },
  },
  {
    id: "knowledge",
    area: "바이블",
    label: "지식 콘텐츠 조회",
    run: async () => {
      const articles = await api.knowledge("running");
      if (articles.length === 0) throw new Error("러닝 콘텐츠가 비어 있음");
      return `러닝 콘텐츠 ${articles.length}개 반환`;
    },
  },
  {
    id: "google-oauth",
    area: "계정",
    label: "Google OAuth 설정",
    run: async () => {
      const provider = await api.authProviders();
      const clientConfigured = Boolean(
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
        process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
        process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      );
      if (!provider.google || !clientConfigured) {
        throw new BlockedDiagnostic("앱·API 양쪽 Google 클라이언트 ID 설정 필요");
      }
      return "앱·API OAuth 설정 확인";
    },
  },
  {
    id: "auth-session",
    area: "계정",
    label: "로그인 세션",
    run: async ({ token }) => {
      if (!token) throw new BlockedDiagnostic("로그인 후 검사 가능");
      const user = await api.me(token);
      return process.env.EXPO_PUBLIC_DEMO_MODE === "true"
        ? `${user.displayName} · 데모 인증 어댑터 통과`
        : `${user.displayName} · 서버 토큰 검증 통과`;
    },
  },
  {
    id: "development-auth",
    area: "계정",
    label: "개발 인증 우회",
    run: async () => {
      if (!__DEV__) throw new BlockedDiagnostic("운영 빌드에서는 비활성화됨");
      const provider = await api.authProviders();
      if (!provider.development) {
        throw new BlockedDiagnostic("개발 API에서 인증 우회가 비활성화됨");
      }
      return "개발 환경 한정 자동 세션 활성";
    },
  },
  {
    id: "routines",
    area: "루틴",
    label: "내 루틴 조회",
    run: async ({ token }) => {
      if (!token) throw new BlockedDiagnostic("로그인 후 검사 가능");
      const routines = await api.routines(token);
      return `${routines.length}개 루틴 반환`;
    },
  },
  {
    id: "routing",
    area: "운동 기록",
    label: "보행 루트 엔진",
    run: async () => {
      const route = await requestPedestrianRoute(
        { latitude: 37.5219, longitude: 126.9243 },
        { latitude: 37.526, longitude: 126.929 },
      );
      if (route.points.length < 2) throw new Error("경로 좌표가 비어 있음");
      return `${route.distanceKm.toFixed(2)}km 테스트 루트 생성`;
    },
  },
  ...appRoutes.map<DiagnosticCheck>(([id, label, path]) => ({
    id,
    area: "페이지",
    label: `${label} 화면 응답`,
    run: async ({ appOrigin }) => {
      if (!appOrigin) throw new BlockedDiagnostic("웹 환경에서 자동 검사 가능");
      const response = await fetch(`${appOrigin}${path}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return `${path} · HTTP ${response.status}`;
    },
  })),
];

class BlockedDiagnostic extends Error {}

export function createRunningDiagnostics(): DiagnosticResult[] {
  return checks.map((check) => ({
    id: check.id,
    area: check.area,
    label: check.label,
    state: "running",
    detail: "검사 중",
    durationMs: 0,
  }));
}

export async function runDiagnostics(token: string | null): Promise<DiagnosticResult[]> {
  const context: DiagnosticContext = {
    token,
    appOrigin:
      typeof globalThis.location === "object" && globalThis.location
        ? globalThis.location.origin
        : null,
  };

  return Promise.all(
    checks.map(async (check) => {
      const startedAt = Date.now();
      try {
        const detail = await check.run(context);
        return {
          id: check.id,
          area: check.area,
          label: check.label,
          state: "pass" as const,
          detail,
          durationMs: Date.now() - startedAt,
        };
      } catch (error) {
        const blocked = error instanceof BlockedDiagnostic;
        return {
          id: check.id,
          area: check.area,
          label: check.label,
          state: blocked ? ("blocked" as const) : ("fail" as const),
          detail: error instanceof Error ? error.message : "알 수 없는 오류",
          durationMs: Date.now() - startedAt,
        };
      }
    }),
  );
}
