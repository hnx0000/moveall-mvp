export type MutationOptions = {
  idempotencyKey: string;
  healthProvider?: "apple-health" | "health-connect";
};
export const mutationHeaders = (options?: MutationOptions): Record<string, string> =>
  options
    ? {
        "Idempotency-Key": options.idempotencyKey,
        ...(options.healthProvider ? { "X-Health-Provider": options.healthProvider } : {}),
      }
    : {};
