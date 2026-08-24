import { Link } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { Card, Screen } from "../src/components/ui";
import { type ThemeColors } from "../src/theme";
import { useAppTheme } from "../src/theme-context";

export default function NotFoundScreen() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <Screen title="페이지를 찾지 못했어요">
      <Card>
        <Text style={styles.text}>요청한 화면이 존재하지 않습니다.</Text>
        <Link href="/" style={styles.link}>
          홈으로 돌아가기
        </Link>
      </Card>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    text: { color: colors.muted, marginBottom: 14 },
    link: { color: colors.primary, fontWeight: "800" },
  });
}
