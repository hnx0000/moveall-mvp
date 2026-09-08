type SessionIdentity = { user: { id: string }; refreshToken: string };

/** Token rotation is not an account change and must not replace the navigator. */
export function onboardingIdentity(session: { user: { id: string } } | null) {
  return session?.user.id ?? null;
}

export function canApplySessionResult(current: SessionIdentity | null, requested: SessionIdentity) {
  return current?.user.id === requested.user.id && current.refreshToken === requested.refreshToken;
}

export function isTerminalAuthFailure(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  return [
    "AUTH_INVALID",
    "AUTH_SESSION_EXPIRED",
    "REFRESH_TOKEN_INVALID",
    "TOKEN_INVALID",
    "AUTH_TOKEN_INVALID",
  ].includes(code ?? "");
}
