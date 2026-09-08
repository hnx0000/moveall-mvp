import {
  AuthSessionSchema,
  type AppleLoginInput,
  type AuthorizationCodeLoginInput,
  type AuthSession,
  type LoginInput,
  type OnboardingInput,
  type OnboardingProfile,
  type RegisterInput,
} from "@moveall/contracts";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform } from "react-native";
import { api } from "../api/client";
import { registerAuthBridge } from "../api/authenticated-request";
import { isOnboardingPending } from "./onboarding-readiness";
import { createSessionRefresher } from "./session-refresh";
import { retireSession } from "./session-handoff";
import { setHealthSyncAccount } from "../features/wearables/health-sync";
import { setNotificationIdentity } from "../features/notifications/push-lifecycle";
import {
  onboardingIdentity,
  canApplySessionResult,
  isTerminalAuthFailure,
} from "./session-lifecycle";

import { authStorageKey as storageKey, isDemoMode } from "../config/runtime";
const sessionRefresher = createSessionRefresher((refreshToken: string) =>
  api.refreshSession({ refreshToken }),
);
const authenticationBypass = isDemoMode;

type AuthContextValue = {
  session: AuthSession | null;
  loginLifetime: number;
  restoring: boolean;
  onboarding: OnboardingProfile | null;
  onboardingLoading: boolean;
  login(input: LoginInput): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  loginWithGoogle(idToken: string): Promise<void>;
  loginWithApple(input: AppleLoginInput): Promise<void>;
  loginWithKakao(input: AuthorizationCodeLoginInput): Promise<void>;
  loginWithNaver(input: AuthorizationCodeLoginInput): Promise<void>;
  replaceSession(session: AuthSession): Promise<void>;
  updateUser(user: AuthSession["user"]): Promise<void>;
  completeOnboarding(input: OnboardingInput): Promise<void>;
  logout(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readSession(): Promise<AuthSession | null> {
  const raw =
    Platform.OS === "web"
      ? globalThis.localStorage?.getItem(storageKey)
      : await SecureStore.getItemAsync(storageKey);
  if (!raw) return null;
  try {
    const parsed = AuthSessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function writeSession(session: AuthSession | null): Promise<void> {
  if (Platform.OS === "web") {
    if (session) globalThis.localStorage?.setItem(storageKey, JSON.stringify(session));
    else globalThis.localStorage?.removeItem(storageKey);
    return;
  }
  if (session) await SecureStore.setItemAsync(storageKey, JSON.stringify(session));
  else await SecureStore.deleteItemAsync(storageKey);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loginLifetime, setLoginLifetime] = useState(0);
  const [restoring, setRestoring] = useState(true);
  const [onboarding, setOnboarding] = useState<OnboardingProfile | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(true);
  const [onboardingResolvedFor, setOnboardingResolvedFor] = useState<string | null>(null);
  const onboardingSessionKey = onboardingIdentity(session);
  const sessionRef = useRef<AuthSession | null>(null);
  const authIntentRef = useRef(0);
  const identityGeneration = useRef(0);
  const accessTokens = useRef(new Set<string>());
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const resolvedUserRef = useRef<string | null>(null);
  const onboardingRevisionRef = useRef(0);
  const [refreshRetry, setRefreshRetry] = useState(0);
  // A restored/changed session must not redirect before its own onboarding request settles.
  const awaitingOnboarding = isOnboardingPending(
    onboardingLoading,
    onboardingResolvedFor,
    onboardingSessionKey,
  );
  const persist = useCallback(async (nextSession: AuthSession | null, replaceIdentity = false) => {
    if (replaceIdentity || sessionRef.current?.user.id !== nextSession?.user.id) {
      identityGeneration.current += 1;
      accessTokens.current.clear();
    }
    if (nextSession) accessTokens.current.add(nextSession.accessToken);
    sessionRef.current = nextSession;
    setHealthSyncAccount(nextSession?.user.id ?? null);
    setLoginLifetime(setNotificationIdentity(nextSession?.user.id ?? null, replaceIdentity));
    setSession(nextSession);
    const write = writeQueueRef.current
      .catch(() => undefined)
      .then(() => writeSession(nextSession));
    writeQueueRef.current = write;
    await write;
  }, []);
  useEffect(
    () =>
      registerAuthBridge({
        capture(token) {
          if (!sessionRef.current || !accessTokens.current.has(token)) return null;
          const generation = identityGeneration.current;
          const intent = authIntentRef.current;
          const userId = sessionRef.current.user.id;
          const isCurrent = () =>
            generation === identityGeneration.current &&
            intent === authIntentRef.current &&
            sessionRef.current?.user.id === userId;
          return {
            ownerId: userId,
            isCurrent,
            accessToken: () => sessionRef.current!.accessToken,
            async refresh(failedToken) {
              if (!isCurrent()) throw Error("로그인 상태가 변경되었습니다.");
              const current = sessionRef.current!;
              if (current.accessToken !== failedToken) return current.accessToken;
              try {
                const next = await sessionRefresher.refresh(current.refreshToken);
                if (!isCurrent()) throw Error("로그인 상태가 변경되었습니다.");
                if (sessionRef.current?.refreshToken === current.refreshToken) await persist(next);
                if (!isCurrent()) throw Error("로그인 상태가 변경되었습니다.");
                return sessionRef.current!.accessToken;
              } catch (error) {
                if (
                  isCurrent() &&
                  sessionRef.current?.refreshToken === current.refreshToken &&
                  isTerminalAuthFailure(error)
                )
                  await persist(null);
                throw error;
              }
            },
          };
        },
      }),
    [persist],
  );
  const authenticate = useCallback(
    async (request: () => Promise<AuthSession>) => {
      const intent = ++authIntentRef.current;
      const result = await request();
      if (intent !== authIntentRef.current) return;
      const previous = sessionRef.current;
      if (previous && previous.refreshToken !== result.refreshToken) {
        await retireSession(previous, { logout: api.logout, refresh: sessionRefresher.refresh });
        if (intent !== authIntentRef.current) return;
      }
      setRefreshRetry(0);
      await persist(result, true);
    },
    [persist],
  );

  useEffect(() => {
    let active = true;
    const intent = ++authIntentRef.current;
    void readSession()
      .then(async (storedSession) => {
        if (!active || intent !== authIntentRef.current) return null;
        if (storedSession) {
          let recoverableSession = storedSession;
          try {
            const shouldRefresh =
              Date.parse(storedSession.accessTokenExpiresAt) <= Date.now() + 60_000;
            const refreshedSession = shouldRefresh
              ? await sessionRefresher.refresh(storedSession.refreshToken)
              : storedSession;
            recoverableSession = refreshedSession;
            const user = await api.me(refreshedSession.accessToken);
            const verifiedSession = { ...refreshedSession, user };
            return verifiedSession;
          } catch (error) {
            if (!isTerminalAuthFailure(error)) return recoverableSession;
            return null;
          }
        }

        if (!authenticationBypass) return null;

        try {
          const developmentSession = await api.devLogin();
          return developmentSession;
        } catch {
          return null;
        }
      })
      .then(async (restored) => {
        if (active && intent === authIntentRef.current) await persist(restored);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [persist]);

  useEffect(() => {
    let active = true;
    const revision = ++onboardingRevisionRef.current;
    if (!session) {
      resolvedUserRef.current = null;
      setOnboarding(null);
      setOnboardingResolvedFor(null);
      setOnboardingLoading(false);
      return () => {
        active = false;
      };
    }

    const userId = session.user.id;
    const blocking = resolvedUserRef.current !== userId;
    if (blocking) {
      setOnboardingLoading(true);
      setOnboarding(null);
    }
    void api
      .onboarding(session.accessToken)
      .then((profile) => {
        if (active && revision === onboardingRevisionRef.current) setOnboarding(profile);
      })
      .catch(() => {
        if (active && blocking && revision === onboardingRevisionRef.current) setOnboarding(null);
      })
      .finally(() => {
        if (active && revision === onboardingRevisionRef.current) {
          resolvedUserRef.current = userId;
          setOnboardingResolvedFor(userId);
          setOnboardingLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [session?.accessToken, session?.user.id]);

  useEffect(() => {
    if (!session) return;
    const refreshIn = refreshRetry
      ? Math.min(60_000, 5_000 * 2 ** Math.min(refreshRetry - 1, 4))
      : Math.max(5_000, Date.parse(session.accessTokenExpiresAt) - Date.now() - 60_000);
    const timer = setTimeout(() => {
      void sessionRefresher
        .refresh(session.refreshToken)
        .then(async (nextSession) => {
          if (!canApplySessionResult(sessionRef.current, session)) return;
          setRefreshRetry(0);
          await persist(nextSession);
        })
        .catch(async (error) => {
          if (!canApplySessionResult(sessionRef.current, session)) return;
          if (isTerminalAuthFailure(error)) await persist(null);
          else setRefreshRetry((attempt) => attempt + 1);
        });
    }, refreshIn);
    return () => clearTimeout(timer);
  }, [persist, session, refreshRetry]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loginLifetime,
      restoring,
      onboarding,
      onboardingLoading: awaitingOnboarding,
      login: async (input) => authenticate(() => api.login(input)),
      register: async (input) => authenticate(() => api.register(input)),
      loginWithGoogle: async (idToken) => authenticate(() => api.googleLogin({ idToken })),
      loginWithApple: async (input) => authenticate(() => api.appleLogin(input)),
      loginWithKakao: async (input) => authenticate(() => api.kakaoLogin(input)),
      loginWithNaver: async (input) => authenticate(() => api.naverLogin(input)),
      replaceSession: async (nextSession) => {
        const intent = ++authIntentRef.current;
        const previous = sessionRef.current;
        if (previous && previous.refreshToken !== nextSession.refreshToken) {
          await retireSession(previous, { logout: api.logout, refresh: sessionRefresher.refresh });
          if (intent !== authIntentRef.current) return;
        }
        await persist(nextSession, true);
      },
      updateUser: async (user) => {
        const current = sessionRef.current;
        if (!current || current.user.id !== user.id) return;
        await persist({ ...current, user });
      },
      completeOnboarding: async (input) => {
        if (!session) return;
        const saved = await api.saveOnboarding(session.accessToken, input);
        if (sessionRef.current?.user.id === session.user.id) {
          ++onboardingRevisionRef.current;
          resolvedUserRef.current = session.user.id;
          setOnboardingResolvedFor(session.user.id);
          setOnboardingLoading(false);
          setOnboarding(saved);
        }
      },
      logout: async () => {
        const intent = ++authIntentRef.current;
        setHealthSyncAccount(null);
        setNotificationIdentity(null);
        sessionRef.current = null;
        const localLogout = persist(null);
        if (session)
          await retireSession(session, {
            logout: api.logout,
            refresh: sessionRefresher.refresh,
          }).catch(() => undefined);
        await localLogout;
        // No late logout result may erase a newly authenticated account.
        if (intent !== authIntentRef.current) return;
        sessionRefresher.clear();
      },
    }),
    [onboarding, awaitingOnboarding, authenticate, persist, restoring, session, loginLifetime],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
