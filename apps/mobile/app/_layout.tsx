import {
  Archivo_700Bold,
  Archivo_800ExtraBold,
  Archivo_800ExtraBold_Italic,
} from "@expo-google-fonts/archivo";
import {
  NotoSansKR_400Regular,
  NotoSansKR_500Medium,
  NotoSansKR_600SemiBold,
  NotoSansKR_700Bold,
} from "@expo-google-fonts/noto-sans-kr";
import { useFonts } from "expo-font";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AuthProvider, useAuth } from "../src/auth/auth-context";
import { ThemeProvider, useAppTheme } from "../src/theme-context";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Archivo_700Bold,
    Archivo_800ExtraBold,
    Archivo_800ExtraBold_Italic,
    NotoSansKR_400Regular,
    NotoSansKR_500Medium,
    NotoSansKR_600SemiBold,
    NotoSansKR_700Bold,
  });

  if (!fontsLoaded) return null;

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
        <Text style={[styles.brand, { color: colors.primary }]}>GROOV</Text>
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
  brand: {
    fontFamily: "Archivo_800ExtraBold_Italic",
    fontSize: 28,
    fontStyle: "italic",
    letterSpacing: -1.5,
  },
  status: { fontFamily: "NotoSansKR_600SemiBold", fontSize: 12 },
});
