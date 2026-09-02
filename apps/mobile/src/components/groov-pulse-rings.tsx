import { Animated, Easing, StyleSheet, View } from "react-native";

export function createGroovPulseAnimation(progress: Animated.Value) {
  return Animated.timing(progress, {
    toValue: 1,
    duration: 650,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  });
}

export function GroovPulseRings({ progress, color }: { progress: Animated.Value; color: string }) {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.layer}
    >
      <Animated.View
        style={[
          styles.ring,
          {
            borderColor: color,
            opacity: progress.interpolate({
              inputRange: [0, 0.25, 1],
              outputRange: [0, 0.72, 0],
            }),
            transform: [
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.42, 1.85] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.ring,
          styles.secondary,
          {
            borderColor: color,
            opacity: progress.interpolate({
              inputRange: [0, 0.4, 1],
              outputRange: [0, 0.35, 0],
            }),
            transform: [
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.28, 2.35] }) },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: { position: "absolute", width: 178, height: 178, borderRadius: 89, borderWidth: 3 },
  secondary: { width: 132, height: 132, borderRadius: 66, borderWidth: 1 },
});
