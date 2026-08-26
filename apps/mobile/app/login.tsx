import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ApiError } from "../src/api/client";
import { useAuth } from "../src/auth/auth-context";
import { type ThemeColors } from "../src/theme";
import { useAppTheme } from "../src/theme-context";

WebBrowser.maybeCompleteAuthSession();

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const placeholderClientId = "google-oauth-client-not-configured.apps.googleusercontent.com";
const demoMode = process.env.EXPO_PUBLIC_LOGIN_REQUIRED !== "true";

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { loginWithGoogle } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configuredClientId = Platform.select({
    ios: iosClientId,
    android: androidClientId,
    default: webClientId,
  });
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      webClientId: webClientId ?? placeholderClientId,
      iosClientId: iosClientId ?? placeholderClientId,
      androidClientId: androidClientId ?? placeholderClientId,
      selectAccount: true,
    },
    { scheme: "moveall", path: "oauthredirect" },
  );

  useEffect(() => {
    if (response?.type !== "success") {
      if (response?.type === "error") setError("Google 인증 창에서 계정을 확인해 주세요.");
      return;
    }
    const idToken = response.params.id_token || response.authentication?.idToken;
    if (!idToken) {
      setError("Google이 인증 토큰을 전달하지 않았습니다. OAuth 설정을 확인해 주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    void loginWithGoogle(idToken)
      .catch((caught) => {
        setError(
          caught instanceof ApiError
            ? caught.message
            : "로그인을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      })
      .finally(() => setSubmitting(false));
  }, [loginWithGoogle, response]);

  const startGoogleLogin = async () => {
    if (!configuredClientId) {
      setError("이 실행 환경의 Google OAuth 클라이언트 ID가 아직 설정되지 않았습니다.");
      return;
    }
    setError(null);
    await promptAsync();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.topBar}>
          <Text style={styles.brand}>MOVEALL</Text>
          <View style={styles.securePill}>
            <View style={styles.secureDot} />
            <Text style={styles.secureText}>SECURE SIGN IN</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.kicker}>MOVE. KEEP. SHARE.</Text>
          <Text style={styles.title}>운동을 시키기보다,{"\n"}계속하고 싶게.</Text>
          <Text style={styles.description}>
            한 번의 계정 연결로 기록, 메달, 피드와 팔로우가 모든 기기에서 이어집니다.
          </Text>
        </View>

        <View style={styles.artwork}>
          <View style={styles.orbitLarge} />
          <View style={styles.orbitSmall} />
          <View style={styles.routeLine} />
          <View style={[styles.routePoint, styles.routeStart]} />
          <View style={[styles.routePoint, styles.routeFinish]} />
          <Text style={styles.artworkNumber}>5.24</Text>
          <Text style={styles.artworkUnit}>KM · TODAY</Text>
        </View>

        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>계정 연결</Text>
          <Text style={styles.loginCaption}>별도 회원가입 없이 Google 계정으로 시작합니다.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Google 계정으로 계속"
            disabled={!request || submitting}
            onPress={() => void startGoogleLogin()}
            style={({ pressed }) => [
              styles.googleButton,
              pressed && styles.googleButtonPressed,
              (!request || submitting) && styles.buttonDisabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#151515" />
            ) : (
              <>
                <Text style={styles.googleMark}>G</Text>
                <Text style={styles.googleText}>Google 계정으로 계속</Text>
              </>
            )}
          </Pressable>
          {demoMode ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void loginWithGoogle("demo-id-token-".padEnd(120, "x"))}
              style={styles.demoButton}
            >
              <Text style={styles.demoButtonText}>MVP 화면 미리보기</Text>
            </Pressable>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!configuredClientId ? (
            <View style={styles.configNotice}>
              <Text style={styles.configTitle}>OAuth 설정 필요</Text>
              <Text style={styles.configText}>
                앱의 환경변수와 API의 GOOGLE_CLIENT_IDS에 동일한 Google 클라이언트 ID를 등록하면
                실제 계정 연결이 활성화됩니다.
              </Text>
            </View>
          ) : null}
          <Text style={styles.legal}>
            계속하면 MoveAll의 이용 정책과 개인정보 처리 원칙에 동의하게 됩니다. Google 비밀번호는
            MoveAll 서버에 전달되거나 저장되지 않습니다.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    page: {
      flexGrow: 1,
      width: "100%",
      maxWidth: 520,
      alignSelf: "center",
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 36,
      gap: 28,
    },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    brand: {
      color: colors.primary,
      fontSize: 20,
      fontWeight: "900",
      fontStyle: "italic",
      letterSpacing: -0.8,
    },
    securePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    secureDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#33A56B" },
    secureText: { color: colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 0.8 },
    hero: { gap: 12, paddingTop: 10 },
    kicker: { color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
    title: {
      color: colors.ink,
      fontSize: 38,
      lineHeight: 47,
      fontWeight: "900",
      letterSpacing: -2,
    },
    description: { color: colors.muted, fontSize: 13, lineHeight: 21, maxWidth: 390 },
    artwork: {
      height: 188,
      overflow: "hidden",
      borderRadius: 14,
      backgroundColor: colors.ink,
      padding: 24,
      justifyContent: "flex-end",
    },
    orbitLarge: {
      position: "absolute",
      width: 210,
      height: 210,
      borderRadius: 105,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.18)",
      right: -25,
      top: -65,
    },
    orbitSmall: {
      position: "absolute",
      width: 112,
      height: 112,
      borderRadius: 56,
      borderWidth: 1,
      borderColor: colors.primary,
      right: 26,
      top: -16,
    },
    routeLine: {
      position: "absolute",
      width: 170,
      height: 50,
      borderTopWidth: 4,
      borderRightWidth: 4,
      borderColor: colors.primary,
      transform: [{ rotate: "-12deg" }],
      right: 32,
      top: 70,
    },
    routePoint: { position: "absolute", width: 10, height: 10, borderRadius: 5 },
    routeStart: { right: 195, top: 91, backgroundColor: "#FFFFFF" },
    routeFinish: { right: 28, top: 65, backgroundColor: colors.primary },
    artworkNumber: { color: "#FFFFFF", fontSize: 45, fontWeight: "900", letterSpacing: -2 },
    artworkUnit: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
    loginCard: { gap: 12 },
    loginTitle: { color: colors.ink, fontSize: 19, fontWeight: "900" },
    loginCaption: { color: colors.muted, fontSize: 11, marginBottom: 4 },
    googleButton: {
      minHeight: 54,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: "#FFFFFF",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    googleButtonPressed: { transform: [{ scale: 0.99 }], opacity: 0.84 },
    buttonDisabled: { opacity: 0.55 },
    googleMark: { color: "#4285F4", fontSize: 18, fontWeight: "900" },
    googleText: { color: "#151515", fontSize: 13, fontWeight: "900" },
    error: { color: "#C94732", fontSize: 11, lineHeight: 17, fontWeight: "700" },
    demoButton: { minHeight: 42, alignItems: "center", justifyContent: "center" },
    demoButtonText: { color: colors.muted, fontSize: 9, fontWeight: "800" },
    configNotice: {
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      backgroundColor: colors.surfaceMuted,
      padding: 12,
      gap: 4,
    },
    configTitle: { color: colors.ink, fontSize: 10, fontWeight: "900" },
    configText: { color: colors.muted, fontSize: 9, lineHeight: 15 },
    legal: { color: colors.muted, fontSize: 8, lineHeight: 14, marginTop: 2 },
  });
}
