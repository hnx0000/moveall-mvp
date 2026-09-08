export type PendingMutation = {
  owner: string;
  kind: "post.create" | "workout.create";
  key: string;
  input: unknown;
  createdAt: string;
};
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, canonical(item)]),
        )
      : value;
/** Write-ahead final JSON only. No token, upload URL, bitmap or implicit replay. */
export function createPendingMutations(
  storage: Storage,
  namespace: string,
  normalizeInput: (kind: PendingMutation["kind"], input: unknown) => unknown = (_kind, input) =>
    input,
) {
  let tail: Promise<unknown> = Promise.resolve();
  const queue = <T>(work: () => Promise<T>) => {
    const result = tail.then(work);
    tail = result.catch(() => undefined);
    return result;
  };
  const storageKey = (owner: string, kind: string) => `${namespace}:${owner}:${kind}`;
  const draftsKey = (owner: string) => `${namespace}:${owner}:rejected-drafts`;
  const readDrafts = async (owner: string): Promise<PendingMutation[]> => {
    const raw = await storage.getItem(draftsKey(owner));
    const items: PendingMutation[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(items) || items.some((item) => item.owner !== owner || !item.key))
      throw Error("보관된 초안을 읽지 못했습니다. 원본을 유지했습니다.");
    return items;
  };
  const read = async (
    owner: string,
    kind: PendingMutation["kind"],
  ): Promise<PendingMutation | null> => {
    const raw = await storage.getItem(storageKey(owner, kind));
    if (!raw) return null;
    const value = JSON.parse(raw) as PendingMutation;
    if (value.owner !== owner || value.kind !== kind || !value.key || !value.input)
      throw Error("임시 저장 요청을 읽지 못했습니다. 원본을 유지했습니다.");
    return value;
  };
  return {
    rejectedDrafts: (owner: string) => queue(() => readDrafts(owner)),
    preserveRejected: (owner: string, kind: PendingMutation["kind"], key: string) =>
      queue(async () => {
        const previous = await read(owner, kind);
        if (!previous || previous.key !== key) return;
        const drafts = await readDrafts(owner);
        if (!drafts.some((item) => item.key === key && item.kind === kind))
          await storage.setItem(draftsKey(owner), JSON.stringify([...drafts, previous]));
        // Release only after the sole copy has a durable, owner-scoped replacement.
        await storage.removeItem(storageKey(owner, kind));
      }),
    list: (owner: string) =>
      queue(async () =>
        (await Promise.all([read(owner, "post.create"), read(owner, "workout.create")])).filter(
          (item): item is PendingMutation => item !== null,
        ),
      ),
    reserve: (item: PendingMutation) =>
      queue(async () => {
        const previous = await read(item.owner, item.kind);
        const normalized = normalizeInput(item.kind, item.input);
        if (
          previous &&
          (previous.key !== item.key ||
            JSON.stringify(canonical(normalizeInput(previous.kind, previous.input))) !==
              JSON.stringify(canonical(normalized)))
        )
          throw Error(
            "이전에 확인되지 않은 저장 요청이 있습니다. 먼저 ‘이전 저장 결과 확인’을 눌러 주세요.",
          );
        if (!previous)
          await storage.setItem(
            storageKey(item.owner, item.kind),
            JSON.stringify({ ...item, input: normalized }),
          );
      }),
    acknowledge: (owner: string, kind: PendingMutation["kind"], key: string) =>
      queue(async () => {
        if ((await read(owner, kind))?.key === key)
          await storage.removeItem(storageKey(owner, kind));
      }),
  };
}
