import { Tabs } from "expo-router";
import { StyleSheet, Text, View, type ColorValue } from "react-native";
import { type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.label,
        tabBarShowLabel: false,
        tabBarIcon: ({ color }) =>
          route.name === "routines" ? (
            <View style={styles.recordIcon}>
              <Text style={styles.recordPlus}>＋</Text>
            </View>
          ) : (
            <TabGlyph color={color} name={route.name} styles={styles} />
          ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "홈", tabBarAccessibilityLabel: "홈" }} />
      <Tabs.Screen name="community" options={{ title: "피드", tabBarAccessibilityLabel: "피드" }} />
      <Tabs.Screen
        name="routines"
        options={{
          title: "기록",
          tabBarAccessibilityLabel: "운동 기록",
        }}
      />
      <Tabs.Screen
        name="knowledge"
        options={{ title: "바이블", tabBarAccessibilityLabel: "운동 바이블" }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "내 정보", tabBarAccessibilityLabel: "내 정보" }}
      />
    </Tabs>
  );
}

function TabGlyph({
  color,
  name,
  styles,
}: {
  color: ColorValue;
  name: string;
  styles: ReturnType<typeof createStyles>;
}) {
  if (name === "community") {
    return (
      <View style={[styles.compass, { borderColor: color }]}>
        <View style={[styles.compassNeedle, { backgroundColor: color }]} />
      </View>
    );
  }
  if (name === "profile") {
    return (
      <View style={styles.personIcon}>
        <View style={[styles.personHead, { borderColor: color }]} />
        <View style={[styles.personBody, { borderColor: color }]} />
      </View>
    );
  }
  return <Text style={[styles.icon, { color }]}>{name === "index" ? "⌂" : "▤"}</Text>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    tabBar: {
      height: 64,
      paddingTop: 7,
      paddingBottom: 7,
      backgroundColor: colors.tab,
      borderTopColor: colors.border,
    },
    label: { fontWeight: "800", fontSize: 10 },
    icon: { fontWeight: "500", fontSize: 23 },
    compass: {
      width: 21,
      height: 21,
      borderWidth: 1.3,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    compassNeedle: { width: 5, height: 10, borderRadius: 3, transform: [{ rotate: "38deg" }] },
    personIcon: { width: 22, height: 23, alignItems: "center" },
    personHead: { width: 8, height: 8, borderWidth: 1.3, borderRadius: 4 },
    personBody: {
      width: 18,
      height: 12,
      borderWidth: 1.3,
      borderBottomWidth: 0,
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
      marginTop: 3,
    },
    recordIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    recordPlus: { color: "#FFFFFF", fontWeight: "300", fontSize: 27, lineHeight: 29 },
  });
}
