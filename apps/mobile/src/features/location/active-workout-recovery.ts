import type { SportType } from "@moveall/contracts";
import type { RecordedTrackPoint } from "./gps-track";
export type ActiveWorkoutCheckpoint = {
  version: 1;
  id: string;
  owner: string;
  sport: SportType;
  startedAt: number;
  savedAt: number;
  elapsedMs: number;
  points: RecordedTrackPoint[];
  pauseBoundaries: number[];
  fields: Record<string, string | string[]>;
};
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
/** One recoverable workout per account. Terminal IDs fence delayed UI/IO writes. */
export function createActiveWorkoutStore(storage: Storage, namespace: string) {
  let tail: Promise<unknown> = Promise.resolve();
  const terminal = new Set<string>();
  const queue = <T>(work: () => Promise<T>) => {
    const result = tail.then(work);
    tail = result.catch(() => undefined);
    return result;
  };
  const key = (owner: string) => `${namespace}:${owner}`;
  const read = async (owner: string): Promise<ActiveWorkoutCheckpoint | null> => {
    const raw = await storage.getItem(key(owner));
    if (!raw) return null;
    const item = JSON.parse(raw) as ActiveWorkoutCheckpoint;
    if (
      item.version !== 1 ||
      item.owner !== owner ||
      !item.id ||
      !Number.isFinite(item.elapsedMs) ||
      !Array.isArray(item.points)
    )
      throw Error("중단된 운동의 임시 기록을 읽지 못했습니다. 원본을 유지했습니다.");
    return item;
  };
  return {
    read: (owner: string) => queue(() => read(owner)),
    write: (item: ActiveWorkoutCheckpoint) =>
      queue(async () => {
        if (terminal.has(item.id)) return false;
        const previous = await read(item.owner);
        if (previous && previous.id !== item.id)
          throw Error("중단된 운동을 먼저 복구하거나 임시 기록을 삭제해 주세요.");
        await storage.setItem(key(item.owner), JSON.stringify(item));
        return true;
      }),
    complete: (owner: string, id: string) => {
      terminal.add(id);
      return queue(async () => {
        if ((await read(owner))?.id === id) await storage.removeItem(key(owner));
      });
    },
  };
}
