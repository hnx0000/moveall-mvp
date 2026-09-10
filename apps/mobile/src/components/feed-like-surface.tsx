import { Heart } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type ViewStyle,
} from "react-native";
import { uiLayout } from "../theme";
import { useAppTheme } from "../theme-context";
import {
  FeedLikeGesture,
  isAccessibleLikeActivation,
  likePulsePosition,
} from "./feed-like-gesture";

type Pulse = { id: number; x: number; y: number; unit: number; level: number; reduced: boolean };

export function FeedLikeSurface({
  children,
  label,
  liked,
  onLike,
  centerPulse = 0,
}: PropsWithChildren<{ label: string; liked: boolean; onLike: () => void; centerPulse?: number }>) {
  const { colors } = useAppTheme();
  const gesture = useRef(new FeedLikeGesture()).current;
  const layout = useRef({ width: 0, height: 0 });
  const sequence = useRef(0);
  const lastCenterPulse = useRef(centerPulse);
  const [pulses, setPulses] = useState<Pulse[]>([]);
  // Until the OS preference is known, choose the less animated fallback.
  const [reducedMotion, setReducedMotion] = useState(true);
  const [screenReader, setScreenReader] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReducedMotion(value);
      })
      .catch(() => undefined);
    if (Platform.OS !== "web") {
      void AccessibilityInfo.isScreenReaderEnabled()
        .then((value) => {
          if (active) setScreenReader(value);
        })
        .catch(() => undefined);
    }
    const motion = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    const reader =
      Platform.OS !== "web"
        ? AccessibilityInfo.addEventListener("screenReaderChanged", setScreenReader)
        : undefined;
    const app = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        gesture.reset();
        setPulses([]);
      }
    });
    return () => {
      active = false;
      motion.remove();
      reader?.remove();
      app.remove();
      gesture.reset();
    };
  }, [gesture]);

  const finishPulse = useCallback((id: number) => {
    setPulses((current) => current.filter((pulse) => pulse.id !== id));
  }, []);

  const emitPulse = useCallback((x: number, y: number) => {
    const { width, height } = layout.current;
    if (width <= 0 || height <= 0) return;
    const pulse: Pulse = {
      id: ++sequence.current,
      ...likePulsePosition(width, height, x, y),
      level: gesture.nextPulse(Date.now()),
      reduced: reducedMotion,
    };
    // Keep outgoing lights alive, but bound the work during rapid repeated taps.
    setPulses((current) => [...current.slice(-4), pulse]);
  }, [gesture, reducedMotion]);

  useEffect(() => {
    if (centerPulse === lastCenterPulse.current) return;
    lastCenterPulse.current = centerPulse;
    if (centerPulse > 0) emitPulse(layout.current.width / 2, layout.current.height / 2);
  }, [centerPulse, emitPulse]);

  function react(x = layout.current.width / 2, y = layout.current.height * 0.43) {
    onLike();
    emitPulse(x, y);
  }

  function press(event: GestureResponderEvent) {
    // React Native Web forwards a raw KeyboardEvent on keyup, and a MouseEvent
    // (without locationX/Y) for pointer clicks. Native touch events have local coordinates.
    const native = (event.nativeEvent ?? event) as unknown as {
      pageX: number;
      pageY: number;
      locationX?: number;
      locationY?: number;
      clientX?: number;
      clientY?: number;
      key?: string;
      detail?: number;
      pointerType?: string;
    };
    const { pageX, pageY } = native;
    if (
      isAccessibleLikeActivation({
        web: Platform.OS === "web",
        screenReader,
        pressing: gesture.pressing,
        key: native.key,
        detail: native.detail,
        pointerType: native.pointerType,
      })
    ) {
      gesture.cancel();
      react();
      return;
    }
    if (!Number.isFinite(pageX) || !Number.isFinite(pageY)) {
      gesture.cancel();
      return;
    }
    if (gesture.end(pageX, pageY, Date.now())) {
      let x = Number.isFinite(native.locationX) ? native.locationX : undefined;
      let y = Number.isFinite(native.locationY) ? native.locationY : undefined;
      if (
        Platform.OS === "web" &&
        Number.isFinite(native.clientX) &&
        Number.isFinite(native.clientY)
      ) {
        const target = event.currentTarget as unknown as HTMLElement;
        const bounds = target?.getBoundingClientRect?.();
        if (bounds && bounds.width > 0 && bounds.height > 0) {
          x = ((native.clientX! - bounds.left) * layout.current.width) / bounds.width;
          y = ((native.clientY! - bounds.top) * layout.current.height) / bounds.height;
        }
      }
      react(x, y);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${liked ? "좋아요 표시됨" : "좋아요"}`}
      accessibilityHint="사진을 빠르게 두 번 누르면 좋아요. 이어서 누르면 효과가 누적됩니다. 키보드나 화면 읽기 도구는 한 번 활성화하세요."
      accessibilityState={{ selected: liked }}
      onAccessibilityTap={() => react()}
      onLayout={(event) => {
        layout.current = event.nativeEvent.layout;
      }}
      onPressIn={(event) => {
        const native = event.nativeEvent ?? event;
        gesture.start(native.pageX, native.pageY, Date.now());
      }}
      onTouchStart={(event) => {
        if (event.nativeEvent.touches.length > 1) gesture.cancel();
      }}
      onTouchMove={(event) => gesture.move(event.nativeEvent.pageX, event.nativeEvent.pageY)}
      onPointerMove={(event) => gesture.move(event.nativeEvent.pageX, event.nativeEvent.pageY)}
      onPointerCancel={() => gesture.cancel()}
      onTouchCancel={() => gesture.cancel()}
      onBlur={() => gesture.cancel()}
      onPress={press}
      style={styles.surface}
    >
      <View pointerEvents="none">{children}</View>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        {pulses.map((pulse) => (
          <LikePulse key={pulse.id} pulse={pulse} color={colors.primary} onFinish={finishPulse} />
        ))}
      </View>
    </Pressable>
  );
}

function LikePulse({
  pulse,
  color,
  onFinish,
}: {
  pulse: Pulse;
  color: string;
  onFinish: (id: number) => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const duration = pulse.reduced ? 600 : 1100 + Math.min(pulse.level, 3) * 60;
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start(({ finished }) => {
      if (finished) onFinish(pulse.id);
    });
    return () => animation.stop();
  }, [duration, onFinish, progress, pulse.id]);

  function track(times: number[], values: number[]) {
    return progress.interpolate({
      inputRange: times.map((time) => time / duration),
      outputRange: values,
      extrapolate: "clamp",
    });
  }

  const heartSize = (70 + pulse.level * 4) * pulse.unit;
  const glow: ViewStyle = Platform.OS === "web"
    ? ({ filter: `drop-shadow(0 0 3px ${color}) drop-shadow(0 0 9px ${color})` } as ViewStyle)
    : { shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowRadius: 9, shadowOpacity: 0.9 };
  return (
    <View style={[styles.origin, { left: pulse.x, top: pulse.y }]}>
      <Animated.View
        style={[
          styles.heart,
          {
            left: -heartSize / 2,
            top: -heartSize / 2,
            width: heartSize,
            height: heartSize,
            // One soft ignition dip, then steady light. No repeating strobe.
            opacity: pulse.reduced
              ? track([0, 440, duration], [0.95, 0.95, 0])
              : track([0, 150, 240, 370, duration - 300, duration], [0, 0.85, 0.45, 1, 1, 0]),
            transform: pulse.reduced
              ? []
              : [
                  { scale: track([0, 370, duration], [0.9, 1, 1.03]) },
                ],
          },
        ]}
      >
        <View style={[StyleSheet.absoluteFill, glow]}>
          <Heart style={StyleSheet.absoluteFill} color={color} fill="none" size={heartSize} strokeWidth={7} opacity={0.13} />
          <Heart style={StyleSheet.absoluteFill} color={color} fill="none" size={heartSize} strokeWidth={4.5} opacity={0.35} />
          <Heart style={StyleSheet.absoluteFill} color={color} fill="none" size={heartSize} strokeWidth={2.7} />
          <Heart style={StyleSheet.absoluteFill} color="#FFF2DB" fill="none" size={heartSize} strokeWidth={1.15} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    width: "100%",
    borderRadius: uiLayout.photoRadius,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({ touchAction: "manipulation", userSelect: "none" } as const)
      : {}),
  },
  origin: { position: "absolute", width: 0, height: 0 },
  heart: { position: "absolute" },
});
