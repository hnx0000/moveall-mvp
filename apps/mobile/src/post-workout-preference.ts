export type PreferenceStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

// Per-account, per-device preference. Missing/invalid settings keep the default prompt enabled.
export function createPostWorkoutPreference(storage: PreferenceStorage) {
  const key = (userId: string) => `groov-post-workout-prompt-v1:${encodeURIComponent(userId)}`;
  return {
    async read(userId: string): Promise<boolean> {
      try {
        return (await storage.getItem(key(userId))) !== "false";
      } catch {
        return true;
      }
    },
    async write(userId: string, enabled: boolean): Promise<void> {
      await storage.setItem(key(userId), String(enabled));
    },
  };
}

export function workoutPostRoute(workoutSessionId: string) {
  return { pathname: "/compose" as const, params: { kind: "post", workoutSessionId } };
}
