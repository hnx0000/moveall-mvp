import AsyncStorage from "@react-native-async-storage/async-storage";
import { PostCreateInputSchema, WorkoutSessionCreateInputSchema } from "@moveall/contracts";
import { ApiError } from "./transport";
import { authStorageKey } from "../config/runtime";
import { requestOwner } from "./authenticated-request";
import { createPendingMutations, type PendingMutation } from "./pending-mutations";
import { activeWorkouts } from "../features/location/active-workout-runtime";
import { normalizePendingInput } from "./pending-input";
export const pendingSaves = createPendingMutations(
  AsyncStorage,
  `${authStorageKey}:pending-v1`,
  normalizePendingInput,
);
const listeners = new Set<() => void>();
export function subscribePendingSaves(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export async function withPendingSave<T>(
  path: string,
  options: RequestInit & { token?: string },
  send: () => Promise<T>,
) {
  const headers = new Headers(options.headers);
  const key = headers.get("Idempotency-Key");
  const kind =
    path === "/v1/posts"
      ? "post.create"
      : path === "/v1/workout-sessions"
        ? "workout.create"
        : null;
  if (
    options.method !== "POST" ||
    !kind ||
    !key ||
    !options.token ||
    headers.has("X-Health-Provider") ||
    typeof options.body !== "string"
  )
    return send();
  const owner = requestOwner(options.token);
  const item: PendingMutation = {
    owner,
    kind,
    key,
    input: JSON.parse(options.body),
    createdAt: new Date().toISOString(),
  };
  const parsed = (
    kind === "post.create" ? PostCreateInputSchema : WorkoutSessionCreateInputSchema
  ).safeParse(item.input);
  if (!parsed.success)
    throw new ApiError(
      "입력 내용을 확인해 주세요. 저장 요청은 보내지 않았습니다.",
      "PREPARE_INPUT_INVALID",
    );
  await pendingSaves.reserve(item).catch((error) => {
    listeners.forEach((notify) => notify());
    throw error;
  });
  requestOwner(options.token); // Do not send if logout/account replacement occurred during disk IO.
  try {
    const result = await send();
    // Cleanup failure must not turn server success into another new save. The same key remains recoverable.
    try {
      if (kind === "workout.create") await activeWorkouts.complete(owner, key);
      await pendingSaves.acknowledge(owner, kind, key);
    } catch {
      /* Keep the same pending key if cleanup fails. */
    }
    listeners.forEach((notify) => notify());
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.code === "POST_INPUT_NOT_CREATED") {
      try {
        await pendingSaves.preserveRejected(owner, kind, key);
      } catch {
        listeners.forEach((notify) => notify());
        throw new ApiError(
          "초안을 보관하지 못해 원본 저장 요청을 유지했습니다. 다시 확인해 주세요.",
          "PENDING_ARCHIVE_FAILED",
        );
      }
    }
    listeners.forEach((notify) => notify());
    throw error;
  }
}
