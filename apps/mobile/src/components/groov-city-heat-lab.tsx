import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { uiLayout, fonts } from "../theme";

export default function GroovCityHeatNativeNotice() {
  const router = useRouter();
  return (
    <View style={styles.page}>
      <Text style={styles.eyebrow}>GROOV LAB</Text>
      <Text style={styles.title}>CITY HEAT 웹 프로토타입</Text>
      <Text style={styles.copy}>현재 테스트판은 웹 화면에서 먼저 검증하고 있습니다.</Text>
      <Pressable onPress={() => router.back()} style={styles.button}>
        <Text style={styles.buttonText}>돌아가기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: "center", backgroundColor: "#080706", flex: 1, justifyContent: "center", padding: 28 },
  eyebrow: { color: "#FF4D24", fontFamily: fonts.displayExtra, fontSize: 11, letterSpacing: 2 },
  title: { color: "#FFF8F4", fontFamily: fonts.bold, fontSize: 24, marginTop: 10 },
  copy: { color: "#A99A92", fontFamily: fonts.regular, fontSize: 14, marginTop: 8, textAlign: "center" },
  button: { backgroundColor: "#FF4D24", borderRadius: uiLayout.controlRadius, marginTop: 20, paddingHorizontal: 20, paddingVertical: 13 },
  buttonText: { color: "#080706", fontFamily: fonts.bold, fontSize: 14 },
});
