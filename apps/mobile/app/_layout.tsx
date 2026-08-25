import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AuthProvider, useAuth } from "../src/auth/auth-context";
import { ThemeProvider, useAppTheme } from "../src/theme-context";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigation />
    </ThemeProvider>
  );
}

function RootNavigation() {
  const { mode } = useAppTheme();

  return (
    <AuthProvider>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <SessionGate />
    </AuthProvider>
  );
}

function SessionGate() {
  const { colors } = useAppTheme();
  const { restoring, session } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const onLoginScreen = segments[0] === "login";

  useEffect(() => {
    if (!navigationState?.key || restoring) return;
    if (!session && !onLoginScreen) router.replace("/login");
    if (session && onLoginScreen) router.replace("/");
  }, [navigationState?.key, onLoginScreen, restoring, router, session]);

  if (restoring) {
    return (
      <View style={[styles.splash, { backgroundColor: colors.background }]}>
        <Text style={[styles.brand, { color: colors.primary }]}>MOVEALL</Text>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.status, { color: colors.muted }]}>안전하게 로그인 확인 중</Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  brand: { fontSize: 28, fontWeight: "900", fontStyle: "italic", letterSpacing: -1.5 },
  status: { fontSize: 12, fontWeight: "700" },
});
