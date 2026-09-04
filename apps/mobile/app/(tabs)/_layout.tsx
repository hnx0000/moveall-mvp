import { Tabs, useRouter } from "expo-router";
import { useRef, type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { fonts, maxContentWidth } from "../../src/theme";
import { bottomNavItems, bottomNavPalette as palette } from "../../src/components/bottom-nav-model";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <MoveallTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: "홈" }} />
      <Tabs.Screen name="community" options={{ title: "TODAY" }} />
      <Tabs.Screen name="routines" options={{ title: "기록" }} />
      <Tabs.Screen name="knowledge" options={{ title: "리그" }} />
      <Tabs.Screen name="profile" options={{ title: "MY" }} />
    </Tabs>
  );
}

function MoveallTabBar({ state, navigation, insets }: TabBarProps) {
  const router = useRouter();
  const longPressed = useRef(false);
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.inner}>
        {state.routes.map((route, index) => {
          const item = bottomNavItems[route.name as keyof typeof bottomNavItems];
          if (!item) return null;
          const isPrimary = route.name === "routines";
          const focused = state.index === index && !isPrimary;
          const color = focused ? palette.active : palette.inactive;
          return (
            <Pressable
              key={route.key}
              accessibilityLabel={item.label}
              accessibilityRole={isPrimary ? "button" : "tab"}
              accessibilityHint={
                isPrimary ? "한 번 누르면 운동 기록, 길게 누르면 콘텐츠 편집" : undefined
              }
              accessibilityState={isPrimary ? {} : { selected: focused }}
              onPress={() => {
                // Releasing a completed hold must not open the recording tab as well.
                if (isPrimary && longPressed.current) return;
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (event.defaultPrevented) return;
                if (state.index !== index) navigation.navigate(route.name);
              }}
              onPressIn={() => {
                longPressed.current = false;
              }}
              onLongPress={
                isPrimary
                  ? () => {
                      if (longPressed.current) return;
                      longPressed.current = true;
                      router.push({ pathname: "/compose", params: { direct: "1" } });
                    }
                  : undefined
              }
              delayLongPress={420}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <View style={isPrimary ? styles.primaryButton : styles.icon}>
                <Svg
                  width={isPrimary ? 29 : 24}
                  height={isPrimary ? 29 : 24}
                  viewBox="0 0 24 24"
                  aria-hidden={true}
                >
                  <Path
                    d={item.path}
                    fill="none"
                    stroke={isPrimary ? palette.plusInk : color}
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              {!isPrimary ? <Text style={[styles.label, { color }]}>{item.label}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
    backgroundColor: palette.background,
    paddingTop: 10,
  },
  inner: {
    width: "100%",
    maxWidth: maxContentWidth,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  tab: {
    flex: 1,
    minWidth: 44,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  icon: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.65 },
  primaryButton: {
    width: 54,
    height: 44,
    borderRadius: 15,
    backgroundColor: palette.active,
    alignItems: "center",
    justifyContent: "center",
  },
});
