/** One switch. Old LOGIN_REQUIRED/DEMO_MODE flags no longer select the data source. */
export function resolveAppMode(value: string | undefined): "live" | "demo" {
  if (value === undefined || value === "" || value === "live") return "live";
  if (value === "demo") return "demo";
  throw new Error("EXPO_PUBLIC_APP_MODE는 live 또는 demo여야 합니다.");
}
export function sessionStorageKey(mode: "live" | "demo", apiUrl: string) {
  // Storage partitioning only, not a credential/hash. SecureStore permits [a-zA-Z0-9._-].
  const scope = Array.from(apiUrl.replace(/\/+$/, ""))
    .map((c) => c.charCodeAt(0).toString(16))
    .join("-");
  return `groov-auth-v2.${mode}.${scope || "unconfigured"}`;
}
