export function assertCompiledAppMode(source, expected) {
  const modes = [...source.matchAll(/resolveAppMode\)?\(\s*["'](live|demo)["']\s*\)/g)].map(
    (match) => match[1],
  );
  if (!modes.length || modes.some((mode) => mode !== expected)) {
    throw new Error(
      `배포 중단: 요청한 ${expected} 모드와 실제 웹 번들의 모드가 일치하지 않습니다.`,
    );
  }
}

export function siteBuildEnvironment(mode, environment) {
  if (mode !== "demo" && mode !== "live") throw new Error("Unknown site build mode");
  return {
    ...environment,
    EXPO_PUBLIC_APP_MODE: mode,
    ...(mode === "demo" ? { EXPO_NO_DOTENV: "1", EXPO_PUBLIC_API_URL: "" } : {}),
  };
}
