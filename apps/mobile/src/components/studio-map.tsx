import { useRef } from "react";
import MapView from "react-native-maps";
import { fitRouteMap, projectRoute } from "./record-studio-model";
import type { StudioMapProps } from "./studio-map.types";

export function StudioMap({ points, labels, onSnapshot, onError }: StudioMapProps) {
  const ref = useRef<MapView>(null);
  const camera = fitRouteMap(points);
  if (!camera) return null;
  const longitudeDelta = (360 * 360) / (512 * 2 ** camera.zoom);
  return (
    <MapView
      ref={ref}
      style={{ width: 360, height: 640 }}
      scrollEnabled={false}
      zoomEnabled={false}
      initialRegion={{
        latitude: camera.latitude,
        longitude: camera.longitude,
        longitudeDelta,
        latitudeDelta: ((longitudeDelta * 640) / 360) * Math.cos((camera.latitude * Math.PI) / 180),
      }}
      customMapStyle={[
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
        ...(!labels ? [{ elementType: "labels", stylers: [{ visibility: "off" }] }] : []),
      ]}
      onMapLoaded={() => {
        void (async () => {
          if (!ref.current) return;
          const bounds = await ref.current.getMapBoundaries();
          const corners = projectRoute([
            { ...bounds.southWest, timestamp: 0 },
            { ...bounds.northEast, timestamp: 0 },
          ]);
          const left = corners[0]!,
            right = corners[1]!;
          const projected = projectRoute(points).map((point) => {
            let x = point.x;
            while (x < left.x - 0.5) x += 1;
            while (x > left.x + 0.5) x -= 1;
            return {
              ...point,
              x: ((x - left.x) / (right.x - left.x)) * 360,
              y: ((point.y - right.y) / (left.y - right.y)) * 640,
            };
          });
          const data = await ref.current.takeSnapshot({
            width: 1080,
            height: 1920,
            format: "png",
            result: "base64",
          });
          onSnapshot(`data:image/png;base64,${data}`, projected);
        })().catch(() => onError("지도를 이미지로 저장하지 못했습니다. 다시 불러와 주세요."));
      }}
    />
  );
}
