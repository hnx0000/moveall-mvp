import { useMemo, useRef } from "react";
import { PanResponder, Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { SportType } from "@moveall/contracts";
import { fonts } from "../theme";
import { SportLogo } from "./sport-logo";
import { StudioTransformHandles } from "./studio-transform-handles";
import { isTextLayer, snapTextPosition, type SnapGuides } from "./studio-snap";
import type { LayerDrag } from "./studio-trash";
import { ROUTE_ORANGE, routePath, type StudioLayer, type XY } from "./record-studio-model";

export function RouteGraphic({
  points,
  width,
  height,
  color = ROUTE_ORANGE,
}: {
  points: XY[];
  width: number;
  height: number;
  color?: string;
}) {
  if (points.length < 2) return null;
  const first = points[0]!,
    last = points.at(-1)!;
  const path = routePath(points);
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path
        d={path}
        stroke="#FFFFFF"
        strokeOpacity={0.85}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={path}
        stroke={color}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={first.x} cy={first.y} r={4} fill="#FFFFFF" stroke={color} strokeWidth={2} />
      <Circle cx={last.x} cy={last.y} r={4} fill={color} stroke="#FFFFFF" strokeWidth={2} />
    </Svg>
  );
}

export function EditableLayer({
  item,
  sport,
  route,
  selected,
  displayScale,
  interactive,
  sheetUri,
  onSelect,
  onChange,
  showBrand = true,
  snapEnabled = false,
  siblings = [],
  onSnapGuides,
  onDrag,
}: {
  item: StudioLayer;
  sport: SportType;
  route: XY[];
  selected: boolean;
  displayScale: number;
  interactive: boolean;
  sheetUri: string | null;
  onSelect: () => void;
  onChange: (patch: Partial<StudioLayer>) => void;
  showBrand?: boolean;
  snapEnabled?: boolean;
  siblings?: StudioLayer[];
  onSnapGuides?: (guides: SnapGuides) => void;
  onDrag?: (event: LayerDrag) => void;
}) {
  const latest = useRef({
    item,
    onChange,
    onSelect,
    interactive,
    displayScale,
    snapEnabled,
    siblings,
    onSnapGuides,
    onDrag,
  });
  latest.current = {
    item,
    onChange,
    onSelect,
    interactive,
    displayScale,
    snapEnabled,
    siblings,
    onSnapGuides,
    onDrag,
  };
  const gestureStart = useRef({ item, distance: 0, angle: 0, dx: 0, dy: 0 });
  const dragging = useRef(false);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => latest.current.interactive,
        onMoveShouldSetPanResponder: () => latest.current.interactive,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          dragging.current = false;
          latest.current.onSnapGuides?.({});
          latest.current.onSelect();
          gestureStart.current = { item: latest.current.item, distance: 0, angle: 0, dx: 0, dy: 0 };
        },
        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches;
          const start = gestureStart.current;
          if (touches.length >= 2) {
            if (dragging.current) {
              latest.current.onDrag?.({
                phase: "cancel",
                x: gesture.moveX,
                y: gesture.moveY,
                origin: start.item,
              });
              dragging.current = false;
            }
            latest.current.onSnapGuides?.({});
            const a = touches[0]!,
              b = touches[1]!;
            const distance = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
            const angle = Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX);
            if (!start.distance) {
              gestureStart.current = {
                item: latest.current.item,
                distance,
                angle,
                dx: gesture.dx,
                dy: gesture.dy,
              };
              return;
            }
            latest.current.onChange({
              scale: (start.item.scale * distance) / start.distance,
              rotation: start.item.rotation + ((angle - start.angle) * 180) / Math.PI,
            });
          } else {
            if (start.distance) {
              gestureStart.current = {
                item: latest.current.item,
                distance: 0,
                angle: 0,
                dx: gesture.dx,
                dy: gesture.dy,
              };
              return;
            }
            const x = start.item.x + (gesture.dx - start.dx) / latest.current.displayScale;
            const y = start.item.y + (gesture.dy - start.dy) / latest.current.displayScale;
            if (Math.hypot(gesture.dx - start.dx, gesture.dy - start.dy) > 4) {
              dragging.current = true;
              latest.current.onDrag?.({
                phase: "move",
                x: gesture.moveX,
                y: gesture.moveY,
                origin: start.item,
              });
            }
            const snapped = latest.current.snapEnabled
              ? snapTextPosition(
                  latest.current.item,
                  x,
                  y,
                  latest.current.siblings,
                  latest.current.displayScale,
                )
              : { x, y, guides: {} };
            latest.current.onSnapGuides?.(snapped.guides);
            latest.current.onChange({ x: snapped.x, y: snapped.y });
          }
        },
        onPanResponderRelease: (_event, gesture) => {
          latest.current.onSnapGuides?.({});
          if (dragging.current)
            latest.current.onDrag?.({
              phase: "end",
              x: gesture.moveX,
              y: gesture.moveY,
              origin: gestureStart.current.item,
            });
          dragging.current = false;
        },
        onPanResponderTerminate: () => {
          latest.current.onSnapGuides?.({});
          if (dragging.current)
            latest.current.onDrag?.({
              phase: "cancel",
              x: 0,
              y: 0,
              origin: gestureStart.current.item,
            });
          dragging.current = false;
        },
      }),
    [],
  );
  return (
    <View
      {...pan.panHandlers}
      accessibilityLabel={`${item.label} · 이동 및 크기 조절`}
      style={{
        position: "absolute",
        left: item.x - item.width / 2,
        top: item.y - item.height / 2,
        width: item.width,
        height: item.height,
        transform: [{ scale: item.scale }, { rotate: `${item.rotation}deg` }],
        ...(Platform.OS === "web"
          ? ({ touchAction: "none", cursor: "move", userSelect: "none" } as object)
          : {}),
      }}
    >
      <View pointerEvents="none" style={{ flex: 1, justifyContent: "center" }}>
        {item.kind === "group" ? (
          <View style={StyleSheet.absoluteFill}>
            {item.children
              ?.filter((child) => child.visible && (showBrand || child.kind !== "brand"))
              .map((child) => (
                <EditableLayer
                  key={child.id}
                  item={child}
                  sport={sport}
                  route={route}
                  selected={false}
                  displayScale={displayScale}
                  interactive={false}
                  sheetUri={sheetUri}
                  onSelect={() => {}}
                  onChange={() => {}}
                />
              ))}
          </View>
        ) : item.kind === "brand" ? (
          showBrand ? (
            <Text
              style={{
                color: item.color,
                fontFamily: fonts.displayItalic,
                fontSize: 24,
                fontStyle: "italic",
                textAlign: "right",
              }}
            >
              GROOV
            </Text>
          ) : null
        ) : item.kind === "route" ? (
          <RouteGraphic points={route} width={item.width} height={item.height} color={item.color} />
        ) : item.kind === "sport" ? (
          <SportLogo
            selected={false}
            color={item.color}
            sport={sport}
            size={item.width}
            {...(sheetUri ? { sheetUri } : {})}
          />
        ) : item.kind === "metric" ? (
          <>
            <Text
              style={{
                color: item.color,
                textAlign: item.textAlign,
                fontFamily: fonts.medium,
                fontSize: 11,
                opacity: 0.9,
              }}
            >
              {item.label}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.55}
              style={{
                color: item.color,
                textAlign: item.textAlign,
                fontFamily: fonts.displayExtra,
                fontSize: 27,
                lineHeight: 37,
              }}
            >
              {item.text}
            </Text>
          </>
        ) : (
          <Text
            style={{
              color: item.color,
              textAlign: item.textAlign,
              fontFamily: fonts.bold,
              fontSize: 23,
              lineHeight: 30,
              overflow: "visible",
            }}
          >
            {item.text}
          </Text>
        )}
      </View>
      {selected ? (
        <StudioTransformHandles
          minimal={isTextLayer(item)}
          width={item.width}
          height={item.height}
          scale={item.scale}
          rotation={item.rotation}
          displayScale={displayScale}
          onChange={onChange}
        />
      ) : null}
    </View>
  );
}
