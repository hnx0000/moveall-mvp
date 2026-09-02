import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";

export function useAsyncData<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestVersion = useRef(0);

  const updateData = useCallback((value: SetStateAction<T | null>) => {
    // A finished mutation must not be overwritten by an older in-flight refresh.
    requestVersion.current += 1;
    setData(value);
    setLoading(false);
    setError(null);
  }, []);

  const reload = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const result = await loader();
      if (version === requestVersion.current) setData(result);
      return true;
    } catch (caught) {
      if (version === requestVersion.current)
        setError(caught instanceof Error ? caught.message : "데이터를 불러오지 못했습니다.");
      return false;
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    void reload();
    return () => {
      requestVersion.current += 1;
    };
  }, [reload]);

  return { data, setData: updateData, error, loading, reload };
}
