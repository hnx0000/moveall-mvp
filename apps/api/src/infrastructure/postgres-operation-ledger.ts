import type { PoolClient } from "pg";
import { checkOperationHash, type OperationContext } from "../domain/mutation-operation.js";
import { AppError } from "../domain/errors.js";
export async function claimOperation(
  client: PoolClient,
  userId: string,
  operation?: OperationContext,
): Promise<string | null> {
  if (!operation) return null;
  const inserted = await client.query(
    "INSERT INTO mutation_operations (user_id, operation_kind, operation_key, request_hash) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING operation_key",
    [userId, operation.kind, operation.key, operation.requestHash],
  );
  if (inserted.rowCount === 1) return null;
  // Separate statement sees the transaction that won the unique-key conflict.
  const result = await client.query<{ request_hash: string; resource_id: string | null }>(
    "SELECT request_hash, resource_id FROM mutation_operations WHERE user_id=$1 AND operation_kind=$2 AND operation_key=$3 FOR UPDATE",
    [userId, operation.kind, operation.key],
  );
  const existing = result.rows[0];
  if (!existing?.resource_id)
    throw new AppError(
      503,
      "OPERATION_NOT_READY",
      "기존 저장 결과를 확인 중입니다. 잠시 후 다시 시도해 주세요.",
    );
  checkOperationHash(existing.request_hash, operation);
  return existing.resource_id;
}
export async function completeOperation(
  client: PoolClient,
  userId: string,
  resourceId: string,
  operation?: OperationContext,
) {
  if (operation)
    await client.query(
      "UPDATE mutation_operations SET resource_id=$4, completed_at=now() WHERE user_id=$1 AND operation_kind=$2 AND operation_key=$3",
      [userId, operation.kind, operation.key, resourceId],
    );
}
