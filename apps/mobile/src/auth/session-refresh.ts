/** Coalesce token rotation, including React effect replay before persistence settles. */
export function createSessionRefresher<T>(request: (token: string) => Promise<T>, now = Date.now) {
  const flights = new Map<string, { promise: Promise<T>; expiresAt: number }>();
  return {
    refresh(token: string) {
      for (const [key, flight] of flights) if (flight.expiresAt < now()) flights.delete(key);
      const existing = flights.get(token);
      if (existing) return existing.promise;
      const flight: { promise: Promise<T>; expiresAt: number } = {
        promise: Promise.resolve(null as T),
        expiresAt: Infinity,
      };
      flight.promise = Promise.resolve()
        .then(() => request(token))
        .then(
          (result) => {
            flight.expiresAt = now() + 30_000;
            return result;
          },
          (error: unknown) => {
            if (flights.get(token) === flight) flights.delete(token);
            throw error;
          },
        );
      flights.set(token, flight);
      return flight.promise;
    },
    clear() {
      flights.clear();
    },
  };
}
