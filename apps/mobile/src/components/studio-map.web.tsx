import { useEffect, useRef } from "react";
import { fitRouteMap } from "./record-studio-model";
import type { StudioMapProps } from "./studio-map.types";

// MapLibre is loaded only in the browser, never during Expo static rendering.
export function StudioMap({ points, labels, onSnapshot, onError }: StudioMapProps) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const camera = fitRouteMap(points);
    if (!host.current || !camera) return;
    let disposed = false;
    let map: import("maplibre-gl").Map | undefined;
    let delivered = false;
    const timeout = setTimeout(() => {
      if (!disposed && !delivered)
        onError("지도 로딩이 지연되고 있습니다. 연결을 확인한 뒤 지도를 다시 불러오세요.");
    }, 25000);
    void import("maplibre-gl")
      .then(({ Map }) => {
        if (disposed || !host.current) return;
        map = new Map({
          container: host.current,
          style: "https://tiles.openfreemap.org/styles/liberty",
          center: [camera.longitude, camera.latitude],
          zoom: camera.zoom,
          interactive: false,
          attributionControl: false,
          canvasContextAttributes: { preserveDrawingBuffer: true },
          pixelRatio: 3,
          fadeDuration: 0,
        });
        map.on("load", () => {
          if (!map || disposed) return;
          for (const item of map.getStyle().layers ?? []) {
            if (item.type === "symbol")
              map.setLayoutProperty(
                item.id,
                "visibility",
                labels && /place|water_name/.test(item.id) ? "visible" : "none",
              );
          }
        });
        map.on("idle", () => {
          if (disposed || delivered || !map?.areTilesLoaded()) return;
          try {
            const uri = map.getCanvas().toDataURL("image/png");
            delivered = true;
            clearTimeout(timeout);
            onSnapshot(uri, camera.points);
          } catch {
            onError(
              "지도를 이미지로 만들지 못했습니다. 다시 불러오거나 사진 배경을 선택해 주세요.",
            );
          }
        });
      })
      .catch(() => {
        if (!disposed)
          onError(
            "지도를 불러오지 못했습니다. 네트워크 또는 브라우저 그래픽 지원을 확인해 주세요.",
          );
      });
    return () => {
      disposed = true;
      clearTimeout(timeout);
      map?.remove();
    };
  }, [points, labels, onSnapshot, onError]);
  return (
    <div
      aria-label="기록 경로 지도 생성 중"
      ref={host}
      style={{
        width: 360,
        height: 640,
        position: "absolute",
        overflow: "hidden",
        pointerEvents: "none",
      }}
    />
  );
}
