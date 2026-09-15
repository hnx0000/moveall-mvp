import { useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { AppState, PanResponder, Platform, View } from "react-native";
import { FeedLikeSurface } from "./feed-like-surface";
import { STORY_DOUBLE_TAP_MS, isStoryDoubleTap, storyGesture } from "./story-navigation";

/** Own the canvas gesture so a double tap cannot advance its first slide. */
export function StoryInteractionSurface({ children, onNavigate, onLike, onBusy, liked, pulse, label }: PropsWithChildren<{
  onNavigate: (direction: -1 | 1, unit: "slide" | "owner") => void;
  onLike: () => void;
  onBusy: (busy: boolean) => void;
  liked: boolean;
  pulse: number;
  label: string;
}>) {
  const latest = useRef({ onNavigate, onLike, onBusy });
  latest.current = { onNavigate, onLike, onBusy };
  const width = useRef(0);
  const down = useRef({ time: 0, x: 0 });
  const moved = useRef(false);
  const multiTouch = useRef(false);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gesturePulse, setGesturePulse] = useState(0);
  const clearTap = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    lastTap.current = null;
  };
  const cancel = () => { clearTap(); latest.current.onBusy(false); };
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      // Do not let the first tap navigate while a second finger press is held.
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      moved.current = false;
      multiTouch.current = event.nativeEvent.touches.length > 1;
      down.current = { time: Date.now(), x: event.nativeEvent.locationX };
      latest.current.onBusy(true);
    },
    onPanResponderMove: (event, gesture) => {
      if (event.nativeEvent.touches.length > 1) multiTouch.current = true;
      if (Math.hypot(gesture.dx, gesture.dy) > 12) moved.current = true;
      if (moved.current || multiTouch.current) clearTap();
    },
    onPanResponderStart: (event) => {
      if (event.nativeEvent.touches.length > 1) { multiTouch.current = true; clearTap(); }
    },
    onPanResponderRelease: (event, gesture) => {
      const now = Date.now();
      const action = storyGesture(gesture.dx, gesture.dy, now - down.current.time);
      if (multiTouch.current || (moved.current && action === "tap")) { cancel(); return; }
      if (action !== "tap") {
        cancel();
        if (action !== "none") latest.current.onNavigate(action === "next-owner" ? 1 : -1, "owner");
        return;
      }
      const x = event.nativeEvent.pageX, y = event.nativeEvent.pageY;
      const previous = lastTap.current;
      if (isStoryDoubleTap(previous, { time: now, x, y })) {
        cancel();
        setGesturePulse((value) => value + 1);
        latest.current.onLike();
        return;
      }
      clearTap();
      lastTap.current = { time: now, x, y };
      const direction = down.current.x < width.current / 2 ? -1 : 1;
      timer.current = setTimeout(() => {
        cancel();
        latest.current.onNavigate(direction, "slide");
      }, STORY_DOUBLE_TAP_MS);
    },
    onPanResponderTerminate: cancel,
    onPanResponderTerminationRequest: () => true,
  }), []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => { if (state !== "active") cancel(); });
    return () => { cancel(); subscription.remove(); };
  }, []);
  return (
    <View {...responder.panHandlers} onLayout={(event) => { width.current = event.nativeEvent.layout.width; }}
      style={Platform.OS === "web" ? { touchAction: "none", userSelect: "none" } : undefined}>
      <FeedLikeSurface label={label} liked={liked} onLike={() => {}} gestureEnabled={false} centerPulse={pulse + gesturePulse}>
        {children}
      </FeedLikeSurface>
    </View>
  );
}
