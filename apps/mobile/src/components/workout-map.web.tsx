import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { type Map as LeafletMap, type LayerGroup, type LeafletMouseEvent } from "leaflet";
import { mapFitPoints, splitRouteSegments } from "./workout-map-model";
import { type MapPlace, type MapPoint, type WorkoutMapProps } from "./workout-map.types";

const FALLBACK_CENTER: MapPoint = { latitude: 37.5284, longitude: 126.9343 };
const EMPTY_PLACES: MapPlace[] = [];
const EMPTY_POINTS: MapPoint[] = [];

export function WorkoutMap({
  points,
  currentPoint,
  primaryColor,
  isSample,
  onReady,
  places = EMPTY_PLACES,
  plannedPoints = EMPTY_POINTS,
  onPointPress,
  badgeLabel,
  compact = false,
  height,
  minimal = true,
  simplified = false,
  staticMode = false,
  showBadge = true,
  backgroundColor = "#E8E7E2",
  showFitButton = false,
  onFullScreenPress,
  controlsBottom = 10,
}: WorkoutMapProps) {
  const hostRef = useRef<View>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const routeLayerRef = useRef<LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const fitRoute = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const leaflet = await import("leaflet");
    const coordinates = mapFitPoints(points, plannedPoints, places).map(
      (point) => [point.latitude, point.longitude] as [number, number],
    );
    if (coordinates.length > 1) {
      map.fitBounds(leaflet.latLngBounds(coordinates), {
        padding: [38, 38],
        maxZoom: simplified ? 15 : 16,
      });
      return;
    }
    const center = currentPoint ?? plannedPoints[0] ?? points[0] ?? places[0] ?? FALLBACK_CENTER;
    map.setView([center.latitude, center.longitude], simplified ? 14 : 15);
  }, [currentPoint, places, plannedPoints, points, simplified]);

  useEffect(() => {
    let mounted = true;
    let createdMap: LeafletMap | null = null;
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return undefined;
    host.style.backgroundColor = backgroundColor;

    void import("leaflet").then((leaflet) => {
      if (!mounted || mapRef.current) return;
      const center =
        currentPoint ?? plannedPoints[0] ?? places[0] ?? points.at(-1) ?? FALLBACK_CENTER;
      createdMap = leaflet.map(host, {
        attributionControl: true,
        zoomControl: false,
        dragging: !staticMode,
        scrollWheelZoom: !staticMode,
        doubleClickZoom: !staticMode,
        touchZoom: !staticMode,
        keyboard: !staticMode,
      });
      createdMap.setView([center.latitude, center.longitude], 14);
      createdMap.attributionControl.setPrefix(false);
      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        })
        .addTo(createdMap);
      const tilePane = createdMap.getPane("tilePane");
      if (tilePane && simplified) {
        // Keep road/place labels legible; soften only the basemap, not the live route or marker.
        tilePane.style.filter = "saturate(.25) contrast(.84) brightness(1.04)";
      } else if (tilePane && minimal) {
        tilePane.style.opacity = "0.17";
        tilePane.style.filter = "grayscale(1) contrast(.42) brightness(1.32) blur(.25px)";
      }
      const attribution = createdMap.attributionControl.getContainer();
      if (attribution && simplified) {
        attribution.style.fontSize = "9px";
        attribution.style.lineHeight = "15px";
        attribution.style.backgroundColor = "rgba(255,255,255,.86)";
      }
      routeLayerRef.current = leaflet.layerGroup().addTo(createdMap);
      mapRef.current = createdMap;
      setMapReady(true);
      onReady?.();
    });

    return () => {
      mounted = false;
      routeLayerRef.current = null;
      mapRef.current = null;
      createdMap?.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onPointPress || staticMode) return undefined;
    const handleClick = (event: LeafletMouseEvent) => {
      onPointPress({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    };
    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [mapReady, onPointPress, staticMode]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !routeLayerRef.current) return;
    let cancelled = false;
    void import("leaflet").then((leaflet) => {
      if (cancelled || !mapRef.current || !routeLayerRef.current) return;
      const layer = routeLayerRef.current;
      layer.clearLayers();
      const recordedCoordinates = toLeafletPoints(points);
      const plannedCoordinates = toLeafletPoints(plannedPoints);

      if (places.length > 0) {
        places.forEach((place) => {
          leaflet
            .circleMarker([place.latitude, place.longitude], {
              radius: 7,
              color: "#FFFFFF",
              weight: 2,
              fillColor: primaryColor,
              fillOpacity: 1,
            })
            .bindTooltip(place.name, { direction: "top" })
            .addTo(layer);
        });
        return;
      }

      if (plannedCoordinates.length > 1) {
        leaflet
          .polyline(plannedCoordinates, {
            color: primaryColor,
            weight: 4,
            opacity: 0.82,
            dashArray: "7 9",
            lineCap: "round",
          })
          .addTo(layer);
        addEndpoint(leaflet, layer, plannedCoordinates[0]!, "S", "출발", "#171719");
        addEndpoint(leaflet, layer, plannedCoordinates.at(-1)!, "F", "도착", primaryColor);
      } else if (plannedCoordinates[0]) {
        addEndpoint(leaflet, layer, plannedCoordinates[0], "S", "출발", "#171719");
      }

      const recordedSegments = splitRouteSegments(points).map(toLeafletPoints);
      recordedSegments.forEach((segment) => {
        if (segment.length < 2) return;
        leaflet
          .polyline(segment, {
            color: primaryColor,
            weight: 6,
            opacity: 1,
            lineCap: "round",
            lineJoin: "round",
          })
          .addTo(layer);
      });
      if (recordedCoordinates.length > 1) {
        addEndpoint(leaflet, layer, recordedCoordinates[0]!, "S", "기록 시작", "#171719");
        addEndpoint(leaflet, layer, recordedCoordinates.at(-1)!, "F", "현재 위치", primaryColor);
      } else if (recordedCoordinates[0]) {
        addEndpoint(leaflet, layer, recordedCoordinates[0], "S", "기록 시작", primaryColor);
      } else if (currentPoint) {
        addEndpoint(
          leaflet,
          layer,
          [currentPoint.latitude, currentPoint.longitude],
          "●",
          "현재 위치",
          primaryColor,
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentPoint, mapReady, places, plannedPoints, points, primaryColor, simplified]);

  return (
    <View
      style={[
        styles.container,
        compact && styles.compact,
        height ? { height } : null,
        { backgroundColor },
      ]}
    >
      <View accessibilityLabel="운동 경로 지도" ref={hostRef} style={styles.map} />
      {showBadge ? (
        <View style={[styles.badge, styles.pointerNone]}>
          <View
            style={[styles.liveDot, { backgroundColor: isSample ? "#777773" : primaryColor }]}
          />
          <Text style={styles.badgeText}>{badgeLabel ?? (isSample ? "ROUTE" : "GPS LIVE")}</Text>
        </View>
      ) : null}
      {!staticMode && (showFitButton || onFullScreenPress) ? (
        <View style={[styles.controls, { bottom: controlsBottom }]}>
          {showFitButton ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void fitRoute()}
              style={styles.controlButton}
            >
              <Text style={styles.controlText}>전체 경로</Text>
            </Pressable>
          ) : null}
          {onFullScreenPress ? (
            <Pressable
              accessibilityRole="button"
              onPress={onFullScreenPress}
              style={styles.controlButton}
            >
              <Text style={styles.controlText}>전체화면</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {!mapReady ? (
        <View style={[styles.loading, styles.pointerNone, { backgroundColor }]}>
          <Text style={styles.loadingText}>MAP LOADING</Text>
        </View>
      ) : null}
    </View>
  );
}

function toLeafletPoints(points: MapPoint[]) {
  return points.map((point) => [point.latitude, point.longitude] as [number, number]);
}

function addEndpoint(
  leaflet: typeof import("leaflet"),
  layer: LayerGroup,
  coordinate: [number, number],
  letter: string,
  tooltip: string,
  color: string,
) {
  leaflet
    .circleMarker(coordinate, {
      radius: 8,
      color: "#FFFFFF",
      weight: 2,
      fillColor: color,
      fillOpacity: 1,
    })
    .bindTooltip(`${letter} · ${tooltip}`, { direction: "top" })
    .addTo(layer);
}

const styles = StyleSheet.create({
  container: {
    height: 232,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  compact: { height: 176 },
  map: { width: "100%", height: "100%" },
  badge: {
    position: "absolute",
    left: 12,
    top: 12,
    minHeight: 27,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "rgba(16,16,17,0.88)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  pointerNone: { pointerEvents: "none" },
  badgeText: { color: "#FFFFFF", fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  loading: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: "#656560", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  controls: { position: "absolute", right: 10, gap: 7, alignItems: "flex-end" },
  controlButton: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: "rgba(16,16,17,0.88)",
  },
  controlText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
});
