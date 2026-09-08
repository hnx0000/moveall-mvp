import type { AuthSession } from "@moveall/contracts";
import { isTerminalAuthFailure } from "./session-lifecycle.ts";

export async function restoreAuthSession(options: {
  demoMode: boolean;
  read(): Promise<AuthSession | null>;
  refresh(token: string): Promise<AuthSession>;
  me(token: string): Promise<AuthSession["user"]>;
  demoLogin(): Promise<AuthSession>;
  isCurrent(): boolean;
}) {
  const stored = await options.read().catch(() => null);
  if (!options.isCurrent()) return null;
  if (stored) {
    let recoverable = stored;
    try {
      if (Date.parse(stored.accessTokenExpiresAt) <= Date.now() + 60_000)
        recoverable = await options.refresh(stored.refreshToken);
      if (!options.isCurrent()) return null;
      return { ...recoverable, user: await options.me(recoverable.accessToken) };
    } catch (error) {
      // Temporary network errors must not destroy a real account's session.
      if (!isTerminalAuthFailure(error)) return recoverable;
    }
  }
  // This is a local demo identity, never an administrator/authentication bypass for live APIs.
  if (options.demoMode && options.isCurrent()) return options.demoLogin();
  return null;
}
