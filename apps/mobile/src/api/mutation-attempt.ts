/** This is an operation identifier, not an authentication credential. */
export function makeOperationKey() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join("")}`
  );
}
export type AttemptStage = <T>(name: string, action: () => Promise<T>) => Promise<T>;
export function createMutationAttempt<Input, Result>(createKey: () => string = makeOperationKey) {
  let owner: string | null = null;
  let key = "";
  let result: { value: Result } | null = null;
  let input: { value: Input } | null = null;
  let flight: Promise<Result> | null = null;
  let revision: string | null = null;
  const stages = new Map<string, unknown>();
  const stage: AttemptStage = async (name, action) => {
    if (stages.has(name)) return stages.get(name) as Awaited<ReturnType<typeof action>>;
    const value = await action();
    stages.set(name, value);
    return value;
  };
  return {
    resetUnsentIfChanged(next: string) {
      if (flight) return;
      if (!input && revision !== next) {
        stages.clear();
        revision = next;
      }
    },
    get committed() {
      return result !== null;
    },
    get prepared() {
      return input !== null;
    },
    run(
      userId: string,
      prepare: (stage: AttemptStage) => Promise<Input>,
      send: (input: Input, key: string) => Promise<Result>,
      isCurrent = () => true,
    ): Promise<Result> {
      if (owner && owner !== userId)
        return Promise.reject(Error("이전 계정의 작성 내용입니다. 편집기를 새로 열어 주세요."));
      if (!isCurrent()) return Promise.reject(Error("로그인 상태가 변경되었습니다."));
      owner ??= userId;
      key ||= createKey();
      if (result) return Promise.resolve(result.value);
      if (flight) return flight;
      flight = (async () => {
        input ??= { value: JSON.parse(JSON.stringify(await prepare(stage))) as Input };
        if (!isCurrent()) throw Error("로그인 상태가 변경되어 게시를 중지했습니다.");
        let value: Result;
        try {
          value = await send(input.value, key);
        } catch (error) {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            ["POST_INPUT_NOT_CREATED", "PREPARE_INPUT_INVALID"].includes(String(error.code))
          ) {
            input = null;
            stages.clear();
            revision = null;
            key = createKey();
          }
          // A later 4xx can refer to an already committed operation (e.g. a crew since deleted).
          // Preserve the frozen key/input until its server result is explicitly reconciled.
          throw error;
        }
        result = { value }; // A navigation/refresh error after this must never publish again.
        return value;
      })().finally(() => {
        flight = null;
      });
      return flight;
    },
  };
}
