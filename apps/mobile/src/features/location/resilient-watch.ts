export type LocationWatchError = { code?: number; message?: string };
type Subscription = { remove(): void };

/** A single owned watch; stale callbacks and late async subscriptions cannot survive restart. */
export function createResilientWatch<T>({
  subscribe,
  onPosition,
  onError,
  onWaiting,
  isVisible = () => true,
  now = Date.now,
  every = setInterval,
  cancel = clearInterval,
}: {
  subscribe: (
    position: (point: T) => void,
    error: (error: LocationWatchError) => void,
  ) => Subscription | Promise<Subscription>;
  onPosition: (point: T) => void;
  onError: (error: LocationWatchError) => void;
  onWaiting: () => void;
  isVisible?: () => boolean;
  now?: () => number;
  every?: typeof setInterval;
  cancel?: typeof clearInterval;
}) {
  let closed = false,
    epoch = 0,
    blocked = false;
  let watch: Subscription | undefined;
  let lastReceipt = now(),
    lastAttempt = -Infinity;
  const restart = () => {
    if (closed || !isVisible()) return;
    const generation = ++epoch;
    watch?.remove();
    watch = undefined;
    lastAttempt = now();
    const current = () => !closed && epoch === generation;
    const fail = (error: LocationWatchError) => {
      if (!current()) return;
      // Do not repeatedly prompt after explicit denial. Resume/retry can recheck permissions.
      blocked = error.code === 1;
      onError(error);
    };
    try {
      Promise.resolve(
        subscribe((point) => {
          if (!current()) return;
          lastReceipt = now();
          blocked = false;
          onPosition(point);
        }, fail),
      ).then((subscription) => {
        if (!current()) subscription.remove();
        else watch = subscription;
      }, fail);
    } catch (error) {
      fail(error as LocationWatchError);
    }
  };
  restart();
  const timer = every(() => {
    if (closed || blocked || !isVisible()) return;
    if (now() - lastReceipt >= 20_000 && now() - lastAttempt >= 30_000) {
      onWaiting();
      restart();
    }
  }, 5_000);
  return {
    resume() {
      if (closed) return;
      blocked = false;
      lastReceipt = now();
      restart();
    },
    remove() {
      closed = true;
      epoch++;
      cancel(timer);
      watch?.remove();
      watch = undefined;
    },
  };
}

// Native Expo options are not web PositionOptions. Pass the browser flags explicitly.
export function subscribeBrowserLocation<T>(
  geolocation: {
    watchPosition(
      success: (point: T) => void,
      error: (error: LocationWatchError) => void,
      options: PositionOptions,
    ): number;
    clearWatch(id: number): void;
  },
  success: (point: T) => void,
  error: (error: LocationWatchError) => void,
) {
  const id = geolocation.watchPosition(success, error, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15_000,
  });
  return { remove: () => geolocation.clearWatch(id) };
}
