import { ApiError } from "./transport.ts";

type Lease = {
  ownerId: string;
  isCurrent(): boolean;
  accessToken(): string;
  refresh(failedToken: string): Promise<string>;
};
export type AuthBridge = { capture(token: string): Lease | null };
let bridge: AuthBridge | null = null;
export function requestOwner(token: string) {
  const lease = bridge?.capture(token);
  if (!lease?.isCurrent()) throw new ApiError("로그인 상태가 변경되었습니다.", "REQUEST_CANCELLED");
  return lease.ownerId;
}
export function registerAuthBridge(next: AuthBridge) {
  bridge = next;
  return () => {
    if (bridge === next) bridge = null;
  };
}
export async function authenticatedRequest<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
  send: (options: RequestInit & { token?: string }) => Promise<T>,
  auth: AuthBridge | null = bridge,
): Promise<T> {
  if (!options.token || path.startsWith("/v1/auth/")) return send(options);
  const lease = auth?.capture(options.token);
  const check = () => {
    if (!lease?.isCurrent() || options.signal?.aborted)
      throw new ApiError("로그인 상태가 변경되었거나 요청이 취소되었습니다.", "REQUEST_CANCELLED");
  };
  check();
  const token = lease!.accessToken();
  try {
    const result = await send({ ...options, token });
    check();
    return result;
  } catch (error) {
    check();
    if (
      !(error instanceof ApiError) ||
      error.status !== 401 ||
      !["AUTH_INVALID", "TOKEN_EXPIRED", "AUTH_TOKEN_EXPIRED"].includes(error.code)
    )
      throw error;
    const refreshed = await lease!.refresh(token);
    check();
    const result = await send({ ...options, token: refreshed });
    check();
    return result;
  }
}
