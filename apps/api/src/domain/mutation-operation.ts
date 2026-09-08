import { createHash } from "node:crypto";
import { AppError } from "./errors.js";
export type OperationContext = {
  kind:
    | "post.create"
    | "workout.create"
    | "health.import:apple-health"
    | "health.import:health-connect";
  key: string;
  requestHash: string;
};
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([, item]) => item !== undefined)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, canonical(item)]),
        )
      : value;
export function mutationOperation(
  headers: Record<string, unknown>,
  kind: "post.create" | "workout.create",
  input: unknown,
): OperationContext | undefined {
  const key = headers["idempotency-key"],
    provider = headers["x-health-provider"];
  if (key === undefined && provider === undefined) return undefined;
  if (typeof key !== "string" || !/^[\x21-\x7e]{1,200}$/.test(key))
    throw new AppError(400, "INVALID_OPERATION_KEY", "저장 요청 식별자를 확인해 주세요.");
  let operationKind: OperationContext["kind"] = kind;
  if (provider !== undefined) {
    if (
      kind !== "workout.create" ||
      !["apple-health", "health-connect"].includes(String(provider)) ||
      (input as { source?: unknown })?.source !== "wearable"
    )
      throw new AppError(400, "INVALID_HEALTH_SOURCE", "건강 기록 제공자를 확인해 주세요.");
    operationKind = `health.import:${provider}` as OperationContext["kind"];
  }
  return {
    key,
    kind: operationKind,
    requestHash: createHash("sha256")
      .update(JSON.stringify(canonical(input)))
      .digest("hex"),
  };
}
export function checkOperationHash(storedHash: string, context: OperationContext) {
  if (!context.kind.startsWith("health.import:") && storedHash !== context.requestHash)
    throw new AppError(
      409,
      "IDEMPOTENCY_KEY_REUSED",
      "이 저장 요청의 내용이 바뀌었습니다. 기존 저장 결과를 확인해 주세요.",
    );
}
export function deletedOperation(context: OperationContext): never {
  throw new AppError(
    410,
    context.kind.startsWith("health.import:") ? "HEALTH_IMPORT_DELETED" : "SAVED_RESOURCE_DELETED",
    "이미 삭제한 기록입니다. 자동으로 다시 만들지 않습니다.",
  );
}

/** MemoryStore has the same retry semantics as PostgreSQL, including deleted-resource tombstones. */
export class MemoryOperationLedger {
  private tails = new Map<string, Promise<unknown>>();
  private generations = new Map<string, number>();
  private rows = new Map<string, { userId: string; hash: string; resourceId: string }>();
  async run<T extends { id: string } | null>(
    userId: string,
    context: OperationContext | undefined,
    create: () => Promise<T>,
    lookup: (id: string) => Promise<T>,
  ): Promise<T> {
    const generation = this.generations.get(userId) ?? 0;
    const current = () => {
      if ((this.generations.get(userId) ?? 0) !== generation)
        throw new AppError(401, "AUTH_INVALID", "탈퇴한 계정의 요청입니다.");
    };
    const result = (this.tails.get(userId) ?? Promise.resolve()).then(async () => {
      current();
      const key = context ? JSON.stringify([userId, context.kind, context.key]) : null;
      const existing = key ? this.rows.get(key) : undefined;
      if (existing && context) {
        checkOperationHash(existing.hash, context);
        const item = await lookup(existing.resourceId);
        current();
        if (!item) deletedOperation(context);
        return item;
      }
      const item = await create();
      current();
      if (item && key && context)
        this.rows.set(key, { userId, hash: context.requestHash, resourceId: item.id });
      return item;
    });
    const tail = result.catch(() => undefined);
    this.tails.set(userId, tail);
    try {
      return await result;
    } finally {
      if (this.tails.get(userId) === tail) this.tails.delete(userId);
    }
  }
  clear(userId: string) {
    this.generations.set(userId, (this.generations.get(userId) ?? 0) + 1);
    for (const [key, row] of this.rows) if (row.userId === userId) this.rows.delete(key);
  }
}
