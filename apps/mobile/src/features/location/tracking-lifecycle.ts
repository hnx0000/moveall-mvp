/** A rejected operation is visible to its caller but never poisons the next queued task. */
export function createSerialTaskQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation);
    tail = result.catch(() => undefined);
    return result;
  };
}

export function createTrackingLifetime() {
  let mounted = false;
  let mountEpoch = 0;
  let generation = 0;
  let watcher: { remove(): void } | null = null;
  const invalidate = () => {
    generation++;
    watcher?.remove();
    watcher = null;
  };
  return {
    mount() {
      mounted = true;
      mountEpoch++;
      generation++;
    },
    unmount() {
      mounted = false;
      invalidate();
    },
    invalidate,
    isMounted: () => mounted,
    scope() {
      const epoch = mountEpoch;
      return () => mounted && epoch === mountEpoch;
    },
    begin() {
      invalidate();
      const requested = generation;
      return () => mounted && requested === generation;
    },
    attach(subscription: { remove(): void }, isCurrent: () => boolean) {
      if (!isCurrent()) {
        subscription.remove();
        return;
      }
      watcher?.remove();
      watcher = subscription;
    },
  };
}

type Point = { timestamp: number };
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  multiRemove(keys: string[]): Promise<void>;
  removeItem(key: string): Promise<void>;
};
type TrackWindow = { sport: string; from: number; until: number | null; checkpointId?: string };
/** Durable buffer transactions; consumption cannot erase a concurrently arriving native batch. */
export function createBackgroundTrackStore<P extends Point>(
  storage: Storage,
  merge: (existing: P[], incoming: P[], sport: string) => P[],
) {
  const enqueue = createSerialTaskQueue();
  const pointKey = "groov-background-workout-points-v1";
  const windowKey = "groov-background-workout-window-v2";
  const read = async (): Promise<P[]> => {
    const raw = await storage.getItem(pointKey);
    const points: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(points)) throw new Error("GPS 임시 기록 형식을 확인하지 못했습니다.");
    return points as P[];
  };
  return {
    read: () => enqueue(read),
    readFor: (checkpointId: string) =>
      enqueue(async () => {
        const raw = await storage.getItem(windowKey);
        return raw && (JSON.parse(raw) as TrackWindow).checkpointId === checkpointId ? read() : [];
      }),
    clear: (checkpointId?: string, isCurrent: () => boolean = () => true) =>
      enqueue(async () => {
        if (!isCurrent()) return;
        if (checkpointId) {
          const raw = await storage.getItem(windowKey);
          if (raw && (JSON.parse(raw) as TrackWindow).checkpointId !== checkpointId) return;
        }
        if (isCurrent())
          await storage.multiRemove([pointKey, windowKey, "groov-background-workout-sport-v1"]);
      }),
    begin: (sport: string, from: number, checkpointId?: string) =>
      enqueue(async () => {
        const raw = await storage.getItem(windowKey);
        if (raw && (JSON.parse(raw) as TrackWindow).checkpointId !== checkpointId)
          await storage.removeItem(pointKey);
        await storage.setItem(
          windowKey,
          JSON.stringify({ sport, from, until: null, checkpointId }),
        );
      }),
    seal: (until: number) =>
      enqueue(async () => {
        const raw = await storage.getItem(windowKey);
        if (raw) {
          const previous = JSON.parse(raw) as TrackWindow;
          await storage.setItem(
            windowKey,
            JSON.stringify({
              ...previous,
              until: previous.until === null ? until : Math.min(previous.until, until),
            }),
          );
        }
      }),
    append: (incoming: P[]) =>
      enqueue(async () => {
        const raw = await storage.getItem(windowKey);
        if (!raw) return;
        const window = JSON.parse(raw) as TrackWindow;
        const accepted = incoming.filter(
          (p) =>
            p.timestamp >= window.from && (window.until === null || p.timestamp <= window.until),
        );
        if (!accepted.length) return;
        await storage.setItem(
          pointKey,
          JSON.stringify(merge(await read(), accepted, window.sport)),
        );
      }),
    consume: (isCurrent: () => boolean = () => true) =>
      enqueue(async () => {
        const points = await read();
        if (!isCurrent()) return [];
        if (points.length) await storage.removeItem(pointKey);
        return points;
      }),
  };
}
