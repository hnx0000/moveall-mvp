import { useCallback, useRef } from "react";
import MapView, { Marker, Polyline, type LatLng } from "react-native-maps";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { mapFitPoints, splitRouteSegments } from "./workout-map-model";
import { type MapPlace, type MapPoint, type WorkoutMapProps } from "./workout-map.types";

const FALLBACK_CENTER: MapPoint = { latitude: 37.5284, longitude: 126.9343 };
const EMPTY_PLACES: MapPlace[] = [];
const EMPTY_POINTS: MapPoint[] = [];

const SIMPLIFIED_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ saturation: -65 }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.text", stylers: [{ visibility: "on" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text",
    stylers: [{ visibility: "on" }],
  },
];

const MINIMAL_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#E8E7E2" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#CBCAC4" }] },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#BEBDB7" }],
  },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#D6DBDB" }] },
];

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
  const mapRef = useRef<MapView>(null);
  const center = currentPoint ?? plannedPoints[0] ?? places[0] ?? points.at(-1) ?? FALLBACK_CENTER;
  const routeSegments = splitRouteSegments(points);

  const fitRoute = useCallback(() => {
    const coordinates = mapFitPoints(points, plannedPoints, places);
    if (coordinates.length > 1) {
      mapRef.current?.fitToCoordinates(coordinates as LatLng[], {
        animated: true,
        edgePadding: { top: 58, right: 38, bottom: 58, left: 38 },
      });
      return;
    }
    mapRef.current?.animateToRegion(
      { ...center, latitudeDelta: 0.018, longitudeDelta: 0.018 },
      350,
    );
  }, [center, places, plannedPoints, points]);

  return (
    <View
      style={[
        styles.container,
        compact && styles.compact,
        height ? { height } : null,
        { backgroundColor },
      ]}
    >
      <MapView
        accessibilityLabel="운동 경로 지도"
        initialRegion={{ ...center, latitudeDelta: 0.025, longitudeDelta: 0.025 }}
        loadingBackgroundColor={backgroundColor}
        loadingEnabled
        pitchEnabled={!staticMode}
        ref={mapRef}
        rotateEnabled={false}
        scrollEnabled={!staticMode}
        showsBuildings={false}
        showsCompass={false}
        showsIndoorLevelPicker={false}
        showsMyLocationButton={!isSample && !staticMode}
        showsPointsOfInterests={false}
        showsScale={false}
        showsTraffic={false}
        showsUserLocation={!isSample && !staticMode}
        style={styles.map}
        toolbarEnabled={false}
        zoomEnabled={!staticMode}
        {...(simplified
          ? { customMapStyle: SIMPLIFIED_MAP_STYLE }
          : minimal
            ? { customMapStyle: MINIMAL_MAP_STYLE }
            : {})}
        {...(onReady ? { onMapReady: onReady } : {})}
        {...(onPointPress && !staticMode
          ? { onPress: (event) => onPointPress(event.nativeEvent.coordinate) }
          : {})}
      >
        {plannedPoints.length > 1 ? (
          <Polyline
            coordinates={plannedPoints}
            lineCap="round"
            lineDashPattern={[7, 9]}
            strokeColor={primaryColor}
            strokeWidth={4}
          />
        ) : null}
        {plannedPoints[0] ? (
          <Marker coordinate={plannedPoints[0]}>
            <Endpoint color="#171719" label="S" />
          </Marker>
        ) : null}
        {plannedPoints.length > 1 && plannedPoints.at(-1) ? (
          <Marker coordinate={plannedPoints.at(-1)!}>
            <Endpoint color={primaryColor} label="F" />
          </Marker>
        ) : null}
        {routeSegments.map((segment, index) =>
          segment.length > 1 ? (
            <Polyline
              coordinates={segment}
              key={`recorded-${index}`}
              lineCap="round"
              strokeColor={primaryColor}
              strokeWidth={6}
            />
          ) : null,
        )}
        {!points.length && currentPoint ? (
          <Marker coordinate={currentPoint} title="현재 위치">
            <Endpoint color={primaryColor} label="●" />
          </Marker>
        ) : null}
        {points[0] ? (
          <Marker coordinate={points[0]}>
            <Endpoint color="#171719" label="S" />
          </Marker>
        ) : null}
        {points.length > 1 && points.at(-1) ? (
          <Marker coordinate={points.at(-1)!}>
            <Endpoint color={primaryColor} label="F" />
          </Marker>
        ) : null}
        {places.map((place) => (
          <Marker
            coordinate={place}
            description={place.description}
            key={place.id}
            title={place.name}
          >
            <View style={[styles.placePin, { backgroundColor: primaryColor }]}>
              <View style={styles.placePinCenter} />
            </View>
          </Marker>
        ))}
      </MapView>
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
            <Pressable accessibilityRole="button" onPress={fitRoute} style={styles.controlButton}>
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
    </View>
  );
}

function Endpoint({ color, label }: { color: string; label: string }) {
  return (
    <View style={[styles.endpoint, { backgroundColor: color }]}>
      <Text style={styles.endpointText}>{label}</Text>
    </View>
  );
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
  endpoint: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  endpointText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  placePin: {
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  placePinCenter: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
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
