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
const authenticationBypass =
  process.env.EXPO_PUBLIC_DEMO_MODE === "true" ||
  (__DEV__ && process.env.EXPO_PUBLIC_DEV_AUTH_BYPASS !== "false");

type AuthContextValue = {
  session: AuthSession | null;
  restoring: boolean;
  login(input: LoginInput): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  loginWithGoogle(idToken: string): Promise<void>;
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

  useEffect(() => {
    void readSession()
      .then(async (storedSession) => {
        if (storedSession) {
          try {
            const user = await api.me(storedSession.accessToken);
            const verifiedSession = { ...storedSession, user };
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

  const persist = useCallback(async (nextSession: AuthSession | null) => {
    setSession(nextSession);
    await writeSession(nextSession);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      restoring,
      login: async (input) => persist(await api.login(input)),
      register: async (input) => persist(await api.register(input)),
      loginWithGoogle: async (idToken) => persist(await api.googleLogin({ idToken })),
      updateUser: async (user) => {
        if (!session) return;
        await persist({ ...session, user });
      },
      logout: async () => persist(null),
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
