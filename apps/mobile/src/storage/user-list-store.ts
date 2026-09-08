export interface UserListStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
/** Serializes read/modify/write per owner. Missing/native storage is never reported as success. */
export function createUserListStore<T>(storage: UserListStorage, namespace: string) {
  const tails = new Map<string, Promise<unknown>>();
  const key = (userId: string) => {
    if (!userId) throw Error("로그인이 필요합니다.");
    return namespace + ":" + encodeURIComponent(userId);
  };
  const read = async (userId: string): Promise<T[]> => {
    const raw = await storage.getItem(key(userId));
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) throw Error("저장된 데이터 형식을 확인해 주세요.");
    return data as T[];
  };
  return {
    async read(userId: string) {
      await tails.get(userId);
      return read(userId);
    },
    update(userId: string, change: (items: T[]) => T[]): Promise<T[]> {
      key(userId);
      const task = (tails.get(userId) ?? Promise.resolve())
        .catch(() => undefined)
        .then(async () => {
          const items = change(await read(userId));
          await storage.setItem(key(userId), JSON.stringify(items));
          return items;
        });
      const tail = task.catch(() => undefined);
      tails.set(userId, tail);
      void tail.finally(() => {
        if (tails.get(userId) === tail) tails.delete(userId);
      });
      return task;
    },
  };
}
