import { Archivo_700Bold } from "@expo-google-fonts/archivo/700Bold";
import { Archivo_800ExtraBold } from "@expo-google-fonts/archivo/800ExtraBold";
import { Archivo_800ExtraBold_Italic } from "@expo-google-fonts/archivo/800ExtraBold_Italic";
import { NotoSansKR_400Regular } from "@expo-google-fonts/noto-sans-kr/400Regular";
import { NotoSansKR_500Medium } from "@expo-google-fonts/noto-sans-kr/500Medium";
import { NotoSansKR_600SemiBold } from "@expo-google-fonts/noto-sans-kr/600SemiBold";
import { NotoSansKR_700Bold } from "@expo-google-fonts/noto-sans-kr/700Bold";
import { useFonts } from "expo-font";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AuthProvider, useAuth } from "../src/auth/auth-context";
import { PushRegistration } from "../src/features/notifications/push-registration";
import { HealthAutoSync } from "../src/features/wearables/health-auto-sync";
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
      <PushRegistration />
      <HealthAutoSync />
      <SessionGate />
    </AuthProvider>
  );
}

function SessionGate() {
  const { colors } = useAppTheme();
  const { onboarding, onboardingLoading, restoring, session } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const onLoginScreen = segments[0] === "login";
  const onOnboardingScreen = segments[0] === "onboarding";
  const onPublicLegalScreen = segments[0] === "legal";
  const onboardingComplete = Boolean(onboarding?.completedAt);

  useEffect(() => {
    if (!navigationState?.key || restoring || (session && onboardingLoading)) return;
    if (!session && !onLoginScreen && !onPublicLegalScreen) router.replace("/login");
    if (session && !onboardingComplete && !onOnboardingScreen && !onPublicLegalScreen) {
      router.replace("/onboarding");
    }
    if (session && onboardingComplete && (onLoginScreen || onOnboardingScreen)) {
      router.replace("/");
    }
  }, [
    navigationState?.key,
    onLoginScreen,
    onOnboardingScreen,
    onPublicLegalScreen,
    onboardingComplete,
    onboardingLoading,
    restoring,
    router,
    session,
  ]);

  if (restoring || (session && onboardingLoading)) {
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
