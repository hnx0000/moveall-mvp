/** Completion-scheduled foreground polling; never overlaps requests. */
export function createPollingLoop(task: (signal: AbortSignal) => Promise<void>, interval = 10_000) {
  let enabled = false,
    disposed = false,
    flight = false,
    timer: ReturnType<typeof setTimeout> | undefined,
    controller: AbortController | undefined,
    errors = 0;
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  const tick = async () => {
    if (!enabled || disposed || flight) return;
    flight = true;
    controller = new AbortController();
    try {
      await task(controller.signal);
      errors = 0;
    } catch {
      errors += 1;
    } finally {
      flight = false;
      controller = undefined;
      if (enabled && !disposed)
        timer = setTimeout(
          () => void tick(),
          Math.min(60_000, interval * 2 ** Math.min(errors, 3)),
        );
    }
  };
  return {
    setActive(active: boolean) {
      enabled = active;
      clear();
      if (active) void tick();
      else controller?.abort();
    },
    stop() {
      disposed = true;
      enabled = false;
      clear();
      controller?.abort();
    },
  };
}
