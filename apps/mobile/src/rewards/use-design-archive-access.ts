import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/auth-context";
import { isDemoMode } from "../config/runtime";

/** Demo previews expose artwork only; they never grant live administrator capabilities. */
export function useDesignArchiveAccess() {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [result, setResult] = useState<{ token: string; allowed: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    if (token && !isDemoMode) {
      void api.accountCapabilities(token)
        .then(({ admin }) => {
          if (active) setResult({ token, allowed: admin === true });
        })
        .catch(() => {
          if (active) setResult({ token, allowed: false });
        });
    }
    return () => { active = false; };
  }, [token]);

  return {
    allowed: Boolean(token && (isDemoMode || (result?.token === token && result.allowed))),
    loading: Boolean(token && !isDemoMode && result?.token !== token),
    preview: isDemoMode,
  };
}
