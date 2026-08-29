import { Image, StyleSheet, View } from "react-native";
import mascotImage from "../../assets/pets/bichon/frames/idle/00.png";

export function PetMascot({ size = 132 }: { size?: number }) {
  return (
    <View style={[styles.glow, { width: size, height: size }]}>
      <Image
        accessibilityLabel="GROOV 운동 메이트 구름이"
        resizeMode="contain"
        source={mascotImage}
        style={{ width: size, height: size }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
  },
});
