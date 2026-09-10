import type { SportType } from "@moveall/contracts";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, View, type ViewStyle } from "react-native";
import { SportLogo } from "./sport-logo";

export function ActivitySportIcon({
  sport,
  selected,
  ignition = 0,
}: {
  sport: SportType;
  selected: boolean;
  ignition?: number;
}) {
  const light = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    light.stopAnimation();
    light.setValue(1);
    if (!selected || reduceMotion) return;
    light.setValue(0.25);
    const animation = Animated.sequence([
      Animated.timing(light, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(light, { toValue: 0.3, duration: 90, useNativeDriver: true }),
      Animated.timing(light, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [selected, ignition, reduceMotion, light]);
  const glow =
    selected && Platform.OS === "web"
      ? ({ filter: "drop-shadow(0 0 2px #ff754a) drop-shadow(0 0 5px #ff4f2588)" } as ViewStyle)
      : selected
        ? {
            shadowColor: "#ff693d",
            shadowOpacity: 0.9,
            shadowRadius: 5,
            shadowOffset: { width: 0, height: 0 },
          }
        : undefined;
  return (
    <Animated.View pointerEvents="none" style={{ opacity: selected ? light : 1 }}>
      <View style={glow}>
        <SportLogo
          sport={sport}
          size={32}
          selected={false}
          color={selected ? "#ffbd9c" : "#858985"}
        />
      </View>
    </Animated.View>
  );
}
