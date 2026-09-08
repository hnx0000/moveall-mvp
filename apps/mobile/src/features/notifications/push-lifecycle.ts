type Registration = { token: string; platform: "ios" | "android"; deviceName?: string };
type PushApi = {
  registerPushDevice(token: string, input: Registration): Promise<unknown>;
  unregisterPushDevice(token: string, pushToken: string): Promise<unknown>;
};
let identity = { userId: null as string | null, lifetime: 0 };
export function setNotificationIdentity(userId: string | null, replace = false) {
  if (replace || userId !== identity.userId) identity = { userId, lifetime: identity.lifetime + 1 };
  return identity.lifetime;
}
export const isNotificationIdentity = (userId: string, lifetime?: number) =>
  userId === identity.userId && (lifetime === undefined || lifetime === identity.lifetime);

/** Serialize network ownership changes, not OS prompts; stale registrations cannot overtake a new login. */
export function createPushRegistrationCoordinator(api: PushApi) {
  let tail: Promise<unknown> = Promise.resolve();
  const queue = (task: () => Promise<void>) => {
    const next = tail.then(task);
    tail = next.catch(() => undefined);
    return next;
  };
  return {
    begin(options: {
      prepare: () => Promise<Registration | null>;
      isCurrent: () => boolean;
      accessToken: () => string;
    }) {
      let cancelled = false;
      let registration: { accessToken: string; pushToken: string } | null = null;
      const current = () => !cancelled && options.isCurrent();
      const cleanup = async () => {
        if (!registration) return;
        const pending = registration;
        try {
          await api.unregisterPushDevice(
            options.isCurrent() ? options.accessToken() : pending.accessToken,
            pending.pushToken,
          );
        } finally {
          registration = null;
        }
      };
      const done = (async () => {
        const input = await options.prepare();
        if (!input || !current()) return;
        await queue(async () => {
          if (!current()) return;
          registration = { accessToken: options.accessToken(), pushToken: input.token };
          try {
            await api.registerPushDevice(registration.accessToken, input);
          } finally {
            if (!current()) await cleanup();
          }
        });
      })();
      return {
        done,
        stop() {
          cancelled = true;
          return queue(cleanup);
        },
      };
    },
  };
}
