export class ApiError extends Error {
  readonly code: string;
  readonly status: number | undefined;
  constructor(message: string, code: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
export async function requestJson<T>(
  baseUrl: string,
  path: string,
  options: RequestInit & { token?: string } = {},
  fetcher: typeof fetch = fetch,
  timeoutMs = 20_000,
): Promise<T> {
  if (!/^https?:\/\//i.test(baseUrl))
    throw new ApiError(
      "실제 API 주소가 설정되지 않았습니다. 실행 환경을 확인해 주세요.",
      "API_NOT_CONFIGURED",
    );
  const controller = new AbortController();
  const { token, signal, ...init } = options;
  let timedOut = false;
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", "Bearer " + token);
  try {
    const response = await fetcher(baseUrl + path, { ...init, headers, signal: controller.signal });
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      if (controller.signal.aborted) throw Error("aborted");
      throw new ApiError(
        "서버 응답 형식을 확인할 수 없습니다.",
        "INVALID_RESPONSE",
        response.status,
      );
    }
    const value = payload as {
      ok?: unknown;
      data?: T;
      error?: { message?: unknown; code?: unknown };
    } | null;
    if (
      value?.ok === false &&
      typeof value.error?.message === "string" &&
      typeof value.error.code === "string"
    )
      throw new ApiError(value.error.message, value.error.code, response.status);
    if (!response.ok)
      throw new ApiError("서버에서 요청을 처리하지 못했습니다.", "HTTP_ERROR", response.status);
    if (!value || value.ok !== true || !Object.prototype.hasOwnProperty.call(value, "data"))
      throw new ApiError(
        "서버 응답 형식을 확인할 수 없습니다.",
        "INVALID_RESPONSE",
        response.status,
      );
    return value.data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (timedOut)
      throw new ApiError(
        "응답이 늦어지고 있습니다. 저장 요청은 같은 화면에서 다시 확인해 주세요.",
        "REQUEST_TIMEOUT",
      );
    if (controller.signal.aborted) throw new ApiError("요청을 취소했습니다.", "REQUEST_CANCELLED");
    throw new ApiError(
      "서버에 연결할 수 없습니다. 네트워크와 API 실행 상태를 확인해 주세요.",
      "NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
