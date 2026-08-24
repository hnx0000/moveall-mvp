import type { AuthSession, LoginInput, RegisterInput } from "@moveall/contracts";
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

type AuthContextValue = {
  session: AuthSession | null;
  restoring: boolean;
  login(input: LoginInput): Promise<void>;
  register(input: RegisterInput): Promise<void>;
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
    return JSON.parse(raw) as AuthSession;
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
