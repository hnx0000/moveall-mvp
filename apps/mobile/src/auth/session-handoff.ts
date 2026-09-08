type Session = { accessToken: string; refreshToken: string };
const errorCode = (error: unknown) =>
  error && typeof error === "object" && "code" in error ? String(error.code) : "";
/** Expiry of an access JWT alone is not proof of server-session revocation. */
export async function retireSession(
  session: Session,
  deps: { logout(token: string): Promise<unknown>; refresh(token: string): Promise<Session> },
) {
  try {
    await deps.logout(session.accessToken);
  } catch (error) {
    if (errorCode(error) === "AUTH_SESSION_EXPIRED") return;
    if (!["AUTH_INVALID", "TOKEN_EXPIRED", "AUTH_TOKEN_EXPIRED"].includes(errorCode(error)))
      throw error;
    const rotated = await deps.refresh(session.refreshToken);
    try {
      await deps.logout(rotated.accessToken);
    } catch (logoutError) {
      if (errorCode(logoutError) !== "AUTH_SESSION_EXPIRED") throw logoutError;
    }
  }
}
