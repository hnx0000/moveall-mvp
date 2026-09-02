import { ArrowDown } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
} from "react-native";
import { fonts } from "../theme";
import { useAppTheme } from "../theme-context";
import { PullToRefreshGesture } from "./pull-to-refresh-gesture";

type Props = ScrollViewProps & {
  onRefresh?: () => Promise<void>;
  refreshing?: boolean;
};

export function RefreshableScrollView({ onRefresh, refreshing = false, style, ...props }: Props) {
  const { colors } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const pull = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || !onRefresh) return;
    const node = scrollRef.current?.getScrollableNode() as HTMLElement | undefined;
    if (!node) return;
    const gesture = new PullToRefreshGesture();
    let input: "mouse" | "touch" | null = null;
    let suppressClickUntil = 0;
    let disposed = false;
    const previousOverscroll = node.style.overscrollBehaviorY;
    node.style.overscrollBehaviorY = "contain";

    const settle = (value: number) => {
      Animated.timing(pull, { toValue: value, duration: 180, useNativeDriver: true }).start();
    };
    const start = (x: number, y: number, target: EventTarget | null) => {
      if (busy.current || !(target instanceof Element)) return false;
      if (
        target.closest(
          "input,textarea,select,[contenteditable=true],[role=slider],.leaflet-container",
        )
      ) {
        return false;
      }
      for (let element = target; element && element !== node; element = element.parentElement!) {
        if (element.scrollTop > 1) return false;
      }
      suppressClickUntil = 0;
      pull.stopAnimation();
      gesture.start(x, y, node.scrollTop);
      return node.scrollTop <= 1;
    };
    const move = (x: number, y: number, event: Event) => {
      if (!input || busy.current) return;
      gesture.move(x, y, node.scrollTop);
      if (gesture.active) {
        if (event.cancelable) event.preventDefault();
        suppressClickUntil = Date.now() + 500;
      }
      pull.setValue(gesture.distance);
      setReady(gesture.ready);
    };
    const finish = (cancelled: boolean) => {
      if (!input) return;
      input = null;
      const wasDragging = gesture.active;
      const shouldRefresh = gesture.end(cancelled);
      if (wasDragging) suppressClickUntil = Date.now() + 500;
      setReady(false);
      if (!shouldRefresh || busy.current) {
        settle(0);
        return;
      }
      busy.current = true;
      settle(48);
      void Promise.resolve()
        .then(onRefresh)
        .catch(() => undefined)
        .finally(() => {
          busy.current = false;
          if (!disposed) settle(0);
        });
    };
    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return finish(true);
      const touch = event.touches[0]!;
      input = start(touch.clientX, touch.clientY, event.target) ? "touch" : null;
    };
    const touchMove = (event: TouchEvent) => {
      if (input !== "touch") return;
      if (event.touches.length !== 1) return finish(true);
      const touch = event.touches[0]!;
      move(touch.clientX, touch.clientY, event);
    };
    const touchEnd = () => {
      if (input === "touch") finish(false);
    };
    const cancel = () => finish(true);
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      input = start(event.clientX, event.clientY, event.target) ? "mouse" : null;
    };
    const pointerMove = (event: PointerEvent) => {
      if (input === "mouse") move(event.clientX, event.clientY, event);
    };
    const pointerUp = () => {
      if (input === "mouse") finish(false);
    };
    const preventDrag = (event: Event) => {
      if (input) event.preventDefault();
    };
    const preventClick = (event: Event) => {
      if (Date.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    node.addEventListener("touchstart", touchStart, { passive: true, capture: true });
    node.addEventListener("touchmove", touchMove, { passive: false, capture: true });
    node.addEventListener("touchend", touchEnd, true);
    node.addEventListener("touchcancel", cancel, true);
    node.addEventListener("pointerdown", pointerDown, true);
    node.addEventListener("dragstart", preventDrag, true);
    node.addEventListener("click", preventClick, true);
    window.addEventListener("pointermove", pointerMove, { passive: false });
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    return () => {
      disposed = true;
      gesture.end(true);
      pull.stopAnimation();
      pull.setValue(0);
      node.style.overscrollBehaviorY = previousOverscroll;
      node.removeEventListener("touchstart", touchStart, true);
      node.removeEventListener("touchmove", touchMove, true);
      node.removeEventListener("touchend", touchEnd, true);
      node.removeEventListener("touchcancel", cancel, true);
      node.removeEventListener("pointerdown", pointerDown, true);
      node.removeEventListener("dragstart", preventDrag, true);
      node.removeEventListener("click", preventClick, true);
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
    };
  }, [onRefresh, pull]);

  if (Platform.OS !== "web" || !onRefresh) {
    return (
      <ScrollView
        {...props}
        style={style}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              colors={[colors.primary]}
              tintColor={colors.primary}
              progressBackgroundColor={colors.surface}
            />
          ) : (
            props.refreshControl
          )
        }
      />
    );
  }

  return (
    <View style={[styles.viewport, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.indicator,
          {
            opacity: pull.interpolate({ inputRange: [0, 24, 92], outputRange: [0, 1, 1] }),
          },
        ]}
      >
        {refreshing ? (
          <ActivityIndicator color={colors.primary} size="small" />
        ) : (
          <View style={{ transform: [{ rotate: ready ? "180deg" : "0deg" }] }}>
            <ArrowDown color={colors.primary} size={18} />
          </View>
        )}
        <Text accessibilityLiveRegion="polite" style={[styles.label, { color: colors.muted }]}>
          {refreshing ? "피드를 새로고침하는 중" : ready ? "놓으면 새로고침" : "당겨서 새로고침"}
        </Text>
      </Animated.View>
      <Animated.View style={[styles.content, { transform: [{ translateY: pull }] }]}>
        <ScrollView {...props} ref={scrollRef} style={styles.content} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: "hidden" },
  content: { flex: 1 },
  indicator: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  label: { fontFamily: fonts.medium, fontSize: 10 },
});
