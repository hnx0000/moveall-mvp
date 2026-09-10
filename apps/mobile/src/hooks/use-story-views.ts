import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";

/** Device-local, viewer-scoped history. Only the displayed slide is marked seen. */
export function useStoryViews(viewerKey: string, activeStoryKey: string | null) {
  const storageKey = `groov.story-views.v1:${viewerKey}`;
  const [history, setHistory] = useState<{ key: string; ids: string[] } | null>(null);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    setHistory(null);
    void AsyncStorage.getItem(storageKey)
      .then((raw) => {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        const ids = Array.isArray(parsed)
          ? parsed.filter((id): id is string => typeof id === "string").slice(-2000)
          : [];
        if (active) setHistory({ key: storageKey, ids });
      })
      .catch(() => {
        if (active) setHistory({ key: storageKey, ids: [] });
      });
    return () => { active = false; };
  }, [storageKey]);

  useEffect(() => {
    if (!activeStoryKey || history?.key !== storageKey) return;
    setHistory((current) => {
      if (!current || current.key !== storageKey || current.ids.includes(activeStoryKey)) return current;
      return { key: storageKey, ids: [...current.ids.slice(-1999), activeStoryKey] };
    });
  }, [activeStoryKey, history?.key, storageKey]);

  useEffect(() => {
    if (!history || history.key !== storageKey) return;
    // Serialize snapshots so a slower old write cannot replace a newer viewed set.
    writes.current = writes.current
      .then(() => AsyncStorage.setItem(history.key, JSON.stringify(history.ids)))
      .catch(() => undefined);
  }, [history, storageKey]);

  return new Set(history?.key === storageKey ? history.ids : []);
}
