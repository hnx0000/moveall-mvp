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
  if (name === "index") {
    return (
      <View style={styles.tabIconFrame}>
        <View style={[styles.homeRoof, { borderColor: color }]} />
        <View style={[styles.homeBody, { borderColor: color }]}>
          <View style={[styles.homeDoor, { borderColor: color }]} />
        </View>
      </View>
    );
  }
  if (name === "community") {
    return (
      <View style={[styles.feedCircle, { borderColor: color }]}>
        <View style={[styles.footprint, styles.footprintLeft]}>
          <View style={[styles.footprintToe, { backgroundColor: color }]} />
          <View style={[styles.footprintSole, { backgroundColor: color }]} />
        </View>
        <View style={[styles.footprint, styles.footprintRight]}>
          <View style={[styles.footprintToe, { backgroundColor: color }]} />
          <View style={[styles.footprintSole, { backgroundColor: color }]} />
        </View>
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
  return (
    <View style={styles.tabIconFrame}>
      <Text style={[styles.icon, { color }]}>▤</Text>
    </View>
  );
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
    tabIconFrame: {
      width: 24,
      height: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    icon: { fontWeight: "500", fontSize: 22, lineHeight: 24 },
    homeRoof: {
      position: "absolute",
      top: 3,
      width: 15,
      height: 15,
      borderLeftWidth: 1.5,
      borderTopWidth: 1.5,
      borderTopLeftRadius: 2,
      transform: [{ rotate: "45deg" }],
    },
    homeBody: {
      position: "absolute",
      bottom: 2,
      width: 17,
      height: 12,
      borderWidth: 1.5,
      borderTopWidth: 0,
      borderBottomLeftRadius: 2,
      borderBottomRightRadius: 2,
      alignItems: "center",
      justifyContent: "flex-end",
    },
    homeDoor: {
      width: 5,
      height: 7,
      borderWidth: 1.5,
      borderBottomWidth: 0,
    },
    feedCircle: {
      width: 22,
      height: 22,
      borderWidth: 1.3,
      borderRadius: 11,
      position: "relative",
    },
    footprint: {
      position: "absolute",
      width: 5,
      height: 11,
      alignItems: "center",
    },
    footprintLeft: {
      left: 5,
      top: 6,
      transform: [{ rotate: "-24deg" }],
    },
    footprintRight: {
      right: 5,
      top: 3,
      transform: [{ rotate: "24deg" }],
    },
    footprintToe: {
      width: 3.5,
      height: 3.5,
      borderRadius: 2,
      marginBottom: 1,
    },
    footprintSole: {
      width: 4.5,
      height: 6.5,
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      borderBottomLeftRadius: 1.5,
      borderBottomRightRadius: 1.5,
    },
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
