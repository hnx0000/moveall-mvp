import {
  AuthSessionSchema,
  type AuthSession,
  type LoginInput,
  type RegisterInput,
} from "@moveall/contracts";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform } from "react-native";
import { api } from "../api/client";

const storageKey = "moveall-auth-session";
const authenticationBypass = process.env.EXPO_PUBLIC_LOGIN_REQUIRED !== "true";

type AuthContextValue = {
  session: AuthSession | null;
  restoring: boolean;
  login(input: LoginInput): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  loginWithGoogle(idToken: string): Promise<void>;
  replaceSession(session: AuthSession): Promise<void>;
  updateUser(user: AuthSession["user"]): Promise<void>;
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
  const [restoring, setRestoring] = useState(true);
  const persist = useCallback(async (nextSession: AuthSession | null) => {
    setSession(nextSession);
    await writeSession(nextSession);
  }, []);

  useEffect(() => {
    void readSession()
      .then(async (storedSession) => {
        if (storedSession) {
          try {
            const shouldRefresh =
              Date.parse(storedSession.accessTokenExpiresAt) <= Date.now() + 60_000;
            const refreshedSession = shouldRefresh
              ? await api.refreshSession({ refreshToken: storedSession.refreshToken })
              : storedSession;
            const user = await api.me(refreshedSession.accessToken);
            const verifiedSession = { ...refreshedSession, user };
            await writeSession(verifiedSession);
            return verifiedSession;
          } catch {
            await writeSession(null);
          }
        }

        if (!authenticationBypass) return null;

        try {
          const developmentSession = await api.devLogin();
          await writeSession(developmentSession);
          return developmentSession;
        } catch {
          return null;
        }
      })
      .then(setSession)
      .finally(() => setRestoring(false));
  }, []);

  useEffect(() => {
    if (!session) return;
    const refreshIn = Math.max(
      5_000,
      Date.parse(session.accessTokenExpiresAt) - Date.now() - 60_000,
    );
    const timer = setTimeout(() => {
      void api
        .refreshSession({ refreshToken: session.refreshToken })
        .then((nextSession) => persist(nextSession))
        .catch(() => persist(null));
    }, refreshIn);
    return () => clearTimeout(timer);
  }, [persist, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      restoring,
      login: async (input) => persist(await api.login(input)),
      register: async (input) => persist(await api.register(input)),
      loginWithGoogle: async (idToken) => persist(await api.googleLogin({ idToken })),
      replaceSession: async (nextSession) => persist(nextSession),
      updateUser: async (user) => {
        if (!session) return;
        await persist({ ...session, user });
      },
      logout: async () => {
        if (session) await api.logout(session.accessToken).catch(() => undefined);
        await persist(null);
      },
    }),
    [persist, restoring, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
