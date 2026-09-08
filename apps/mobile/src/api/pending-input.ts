import { PostCreateInputSchema, WorkoutSessionCreateInputSchema } from "@moveall/contracts";
import type { PendingMutation } from "./pending-mutations";

// The outbox and replay compare the server's accepted shape, not transient GPS/UI fields.
export function normalizePendingInput(kind: PendingMutation["kind"], input: unknown): unknown {
  return (kind === "post.create" ? PostCreateInputSchema : WorkoutSessionCreateInputSchema).parse(
    input,
  );
}
