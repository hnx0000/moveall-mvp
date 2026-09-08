import { createElement, useEffect, useRef, useState } from "react";
import { acceptsMapMessage } from "../features/maps/map-state";
import type { MapSurfaceProps } from "./groov-map-surface.types";

export function GroovMapSurface({ kind, compact = false, state, onMessage }: MapSurfaceProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [channel] = useState(() => crypto.randomUUID());
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const latest = useRef({ state, onMessage });
  latest.current = { state, onMessage };
  const src = `/groov-maps/${kind === "ranking" ? "index" : "detail"}.html?embedded=1&kind=${kind}&view=explore&compact=${compact ? 1 : 0}&channel=${channel}&v=app-map-2&attempt=${attempt}`;
  const send = (type: string, payload: unknown) =>
    frame.current?.contentWindow?.postMessage(
      { source: "groov-app", channel, type, payload },
      window.location.origin,
    );
  useEffect(() => {
    setReady(false);
    setFailed(false);
    const timeout = setTimeout(() => setFailed(true), 30000);
    const receive = async (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== frame.current?.contentWindow ||
        !acceptsMapMessage(event.data, channel)
      )
        return;
      const { type, payload } = event.data;
      if (type === "ready") {
        clearTimeout(timeout);
        setReady(true);
        setFailed(false);
        send("state", latest.current.state);
        return;
      }
      try {
        const value = await latest.current.onMessage(type, payload);
        if (payload.id) send("reply", { id: payload.id, value });
      } catch (error) {
        if (payload.id)
          send("reply", {
            id: payload.id,
            error: error instanceof Error ? error.message : "앱 지도 연결에 실패했습니다.",
          });
      }
    };
    window.addEventListener("message", receive);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
  }, [channel, attempt]);
  useEffect(() => {
    if (ready) send("state", state);
  }, [state, ready]);
  return createElement(
    "div",
    { style: { position: "relative", width: "100%", height: "100%", background: "#101113" } },
    createElement("iframe", {
      ref: frame,
      src,
      title: kind === "course" ? "GROOV 코스지도" : "GROOV 랭킹지도",
      allow: "geolocation; fullscreen",
      style: { display: "block", width: "100%", height: "100%", border: 0 },
      onError: () => setFailed(true),
    }),
    failed
      ? createElement(
          "button",
          {
            onClick: () => setAttempt((a) => a + 1),
            style: {
              position: "absolute",
              inset: "35% 12%",
              background: "#161616",
              color: "#ff5733",
              border: "1px solid #ff5733",
              borderRadius: 12,
              padding: 16,
            },
          },
          "지도 연결 확인 · 다시 불러오기",
        )
      : null,
  );
}
