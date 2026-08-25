import { Tabs } from "expo-router";
import { StyleSheet, View, type ColorValue } from "react-native";
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
            <RecordTabIcon styles={styles} />
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
      <View style={styles.bookIcon}>
        <View style={[styles.bookPage, styles.bookPageLeft, { borderColor: color }]} />
        <View style={[styles.bookPage, styles.bookPageRight, { borderColor: color }]} />
        <View style={[styles.bookSpine, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function RecordTabIcon({ styles }: { styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.recordIcon}>
      <View style={styles.recordRouteLineLeft} />
      <View style={styles.recordRouteLineRight} />
      <View style={styles.recordStartDot} />
      <View style={styles.recordMiddleDot} />
      <View style={styles.recordFinishPin}>
        <View style={styles.recordFinishCenter} />
      </View>
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
    homeRoof: {
      position: "absolute",
      top: 3,
      width: 15,
      height: 15,
      borderLeftWidth: 1.8,
      borderTopWidth: 1.8,
      borderTopLeftRadius: 2,
      transform: [{ rotate: "45deg" }],
    },
    homeBody: {
      position: "absolute",
      bottom: 2,
      width: 17,
      height: 12,
      borderWidth: 1.8,
      borderTopWidth: 0,
      borderBottomLeftRadius: 2,
      borderBottomRightRadius: 2,
      alignItems: "center",
      justifyContent: "flex-end",
    },
    homeDoor: {
      width: 5,
      height: 7,
      borderWidth: 1.8,
      borderBottomWidth: 0,
    },
    feedCircle: {
      width: 22,
      height: 22,
      borderWidth: 1.8,
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
    bookIcon: {
      width: 22,
      height: 21,
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "center",
      position: "relative",
    },
    bookPage: {
      width: 11,
      height: 19,
      borderWidth: 1.8,
      backgroundColor: "transparent",
    },
    bookPageLeft: {
      borderTopLeftRadius: 3,
      borderBottomLeftRadius: 3,
      borderRightWidth: 0,
      transform: [{ skewY: "5deg" }],
    },
    bookPageRight: {
      borderTopRightRadius: 3,
      borderBottomRightRadius: 3,
      borderLeftWidth: 0,
      transform: [{ skewY: "-5deg" }],
    },
    bookSpine: {
      position: "absolute",
      top: 1,
      bottom: 1,
      left: 10.1,
      width: 1.8,
      borderRadius: 1,
    },
    personIcon: { width: 24, height: 24, alignItems: "center", paddingTop: 1 },
    personHead: { width: 8.5, height: 8.5, borderWidth: 1.8, borderRadius: 5 },
    personBody: {
      width: 19,
      height: 12,
      borderWidth: 1.8,
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
    recordRouteLineLeft: {
      position: "absolute",
      left: 10,
      top: 21,
      width: 11,
      height: 2.2,
      borderRadius: 2,
      backgroundColor: "#FFFFFF",
      transform: [{ rotate: "-36deg" }],
    },
    recordRouteLineRight: {
      position: "absolute",
      left: 19,
      top: 16,
      width: 10,
      height: 2.2,
      borderRadius: 2,
      backgroundColor: "#FFFFFF",
      transform: [{ rotate: "27deg" }],
    },
    recordStartDot: {
      position: "absolute",
      left: 8,
      bottom: 10,
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: "#FFFFFF",
    },
    recordMiddleDot: {
      position: "absolute",
      left: 19,
      top: 16,
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: "#FFFFFF",
    },
    recordFinishPin: {
      position: "absolute",
      right: 8,
      top: 8,
      width: 9,
      height: 9,
      borderWidth: 2,
      borderColor: "#FFFFFF",
      borderRadius: 5,
      alignItems: "center",
      justifyContent: "center",
    },
    recordFinishCenter: {
      width: 2.5,
      height: 2.5,
      borderRadius: 2,
      backgroundColor: "#FFFFFF",
    },
  });
}
