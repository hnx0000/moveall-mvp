import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import { CirclePlus, Compass, Home, Trophy, User, type LucideIcon } from "lucide-react-native";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { gradients, maxContentWidth, radius, shadows, type ThemeColors } from "../../src/theme";
import { useAppTheme } from "../../src/theme-context";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const icons: Record<string, LucideIcon> = {
  index: Home,
  community: Compass,
  routines: CirclePlus,
  knowledge: Trophy,
  profile: User,
};

const labels: Record<string, string> = {
  index: "홈",
  community: "피드",
  routines: "운동 기록",
  knowledge: "동네 리그",
  profile: "내 정보",
};

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <MoveallTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: "홈" }} />
      <Tabs.Screen name="community" options={{ title: "피드" }} />
      <Tabs.Screen name="routines" options={{ title: "기록" }} />
      <Tabs.Screen name="knowledge" options={{ title: "동네 리그" }} />
      <Tabs.Screen name="profile" options={{ title: "내 정보" }} />
    </Tabs>
  );
}

function MoveallTabBar({ state, navigation, insets }: TabBarProps) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.inner}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = icons[route.name] ?? Home;
          const isPrimary = route.name === "routines";
          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Pressable
              accessibilityLabel={labels[route.name] ?? route.name}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              key={route.key}
              onPress={onPress}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              {isPrimary && focused ? (
                <LinearGradient
                  colors={gradients.primary.colors}
                  end={gradients.primary.end}
                  start={gradients.primary.start}
                  style={[styles.primaryButton, shadows.pop]}
                >
                  <Icon color="#FFFFFF" size={25} strokeWidth={2.7} />
                </LinearGradient>
              ) : isPrimary ? (
                <View style={styles.primaryButtonIdle}>
                  <Icon color={colors.muted} size={25} strokeWidth={2.2} />
                </View>
              ) : (
                <Icon
                  color={focused ? colors.primary : colors.muted}
                  fill={focused ? colors.primarySoft : "transparent"}
                  size={24}
                  strokeWidth={focused ? 2.6 : 2.15}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.tab,
      paddingTop: 8,
    },
    inner: {
      width: "100%",
      maxWidth: maxContentWidth,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
    },
    tab: { height: 50, width: 50, alignItems: "center", justifyContent: "center" },
    pressed: { opacity: 0.7 },
    primaryButton: {
      height: 48,
      width: 48,
      borderRadius: radius["2xl"],
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonIdle: {
      height: 48,
      width: 48,
      borderRadius: radius["2xl"],
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
