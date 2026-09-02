import * as Google from "expo-auth-session/providers/google";
import * as AuthSession from "expo-auth-session";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { Link } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
const kakaoClientId = process.env.EXPO_PUBLIC_KAKAO_REST_API_KEY;
const naverClientId = process.env.EXPO_PUBLIC_NAVER_CLIENT_ID;
const placeholderClientId = "google-oauth-client-not-configured.apps.googleusercontent.com";
const demoMode = process.env.EXPO_PUBLIC_LOGIN_REQUIRED !== "true";

export default function LoginScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { login, register, loginWithApple, loginWithGoogle, loginWithKakao, loginWithNaver } =
    useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailMode, setEmailMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const configuredClientId = Platform.select({
    ios: iosClientId,
    android: androidClientId,
    default: webClientId,
  });
  const redirectUri = AuthSession.makeRedirectUri({ scheme: "groov", path: "oauthredirect" });
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      webClientId: webClientId ?? placeholderClientId,
      iosClientId: iosClientId ?? placeholderClientId,
      androidClientId: androidClientId ?? placeholderClientId,
      selectAccount: true,
    },
    { scheme: "groov", path: "oauthredirect" },
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
    if (!configuredClientId || !request) {
      setError("이 실행 환경의 Google OAuth 클라이언트 ID가 아직 설정되지 않았습니다.");
      return;
    }
    setError(null);
    await promptAsync();
  };

  const startRegionalLogin = async (provider: "kakao" | "naver") => {
    const clientId = provider === "kakao" ? kakaoClientId : naverClientId;
    if (!clientId) {
      setError(
        provider === "kakao"
          ? "카카오 로그인 키가 아직 등록되지 않았습니다."
          : "네이버 로그인 키가 아직 등록되지 않았습니다.",
      );
      return;
    }

    setError(null);
    const authRequest = new AuthSession.AuthRequest({
      clientId,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      scopes: provider === "kakao" ? ["profile_nickname", "account_email"] : [],
      usePKCE: false,
    });
    const discovery: AuthSession.DiscoveryDocument =
      provider === "kakao"
        ? {
            authorizationEndpoint: "https://kauth.kakao.com/oauth/authorize",
            tokenEndpoint: "https://kauth.kakao.com/oauth/token",
          }
        : {
            authorizationEndpoint: "https://nid.naver.com/oauth2.0/authorize",
            tokenEndpoint: "https://nid.naver.com/oauth2.0/token",
          };

    try {
      const result = await authRequest.promptAsync(discovery);
      if (result.type === "dismiss" || result.type === "cancel") return;
      if (result.type !== "success" || !result.params.code) {
        throw new Error(`${provider} authorization code missing`);
      }
      setSubmitting(true);
      const input = {
        code: result.params.code,
        redirectUri,
        ...(result.params.state ? { state: result.params.state } : {}),
      };
      if (provider === "kakao") await loginWithKakao(input);
      else await loginWithNaver(input);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : provider === "kakao"
            ? "카카오 계정으로 로그인하지 못했습니다. 다시 시도해 주세요."
            : "네이버 계정으로 로그인하지 못했습니다. 다시 시도해 주세요.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitEmail = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (emailMode === "register") {
        await register({ email, password, displayName });
      } else {
        await login({ email, password });
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : emailMode === "register"
            ? "회원가입을 완료하지 못했습니다. 입력 내용을 확인해 주세요."
            : "로그인하지 못했습니다. 이메일과 비밀번호를 확인해 주세요.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const signInWithApple = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error("Apple identity token missing");
      }
      const displayName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(" ")
        .trim();
      await loginWithApple({
        identityToken: credential.identityToken,
        ...(credential.email ? { email: credential.email } : {}),
        ...(displayName.length >= 2 ? { displayName } : {}),
      });
    } catch (caught) {
      if (
        caught &&
        typeof caught === "object" &&
        "code" in caught &&
        caught.code === "ERR_REQUEST_CANCELED"
      ) {
        return;
      }
      setError("Apple 계정으로 로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.topBar}>
          <Text style={styles.brand}>GROOV</Text>
          <Text style={styles.edition}>GROOV 2.0</Text>
        </View>

        <View style={styles.hero}>
          <Text style={styles.kicker}>YOUR MOVE, YOUR GROOV.</Text>
          <Text style={styles.title}>움직임이 쌓여,{"\n"}나를 만든다.</Text>
          <Text style={styles.description}>기록하고, 나누고, 다시 움직이는 운동의 리듬.</Text>
        </View>

        <View style={styles.groovLoop}>
          <View style={styles.loopHeader}>
            <Text style={styles.loopEyebrow}>THE GROOV LOOP</Text>
            <View style={styles.loopPulse} />
          </View>
          <View style={styles.loopSteps}>
            <View style={styles.loopStep}>
              <Text style={styles.loopIndex}>01</Text>
              <Text style={styles.loopTitle}>기록</Text>
              <Text style={styles.loopCaption}>오늘의 움직임</Text>
            </View>
            <View style={styles.loopConnector} />
            <View style={styles.loopStep}>
              <Text style={styles.loopIndex}>02</Text>
              <Text style={styles.loopTitle}>연결</Text>
              <Text style={styles.loopCaption}>함께하는 리듬</Text>
            </View>
            <View style={styles.loopConnector} />
            <View style={styles.loopStep}>
              <Text style={styles.loopIndex}>03</Text>
              <Text style={styles.loopTitle}>도전</Text>
              <Text style={styles.loopCaption}>다음의 나</Text>
            </View>
          </View>
        </View>

        <View style={styles.loginCard}>
          <View style={styles.loginHeading}>
            <Text style={styles.loginTitle}>GROOV 시작하기</Text>
            <Text style={styles.loginCaption}>오늘의 움직임을 내 기록으로 남겨보세요.</Text>
          </View>
          <View style={styles.socialButtons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Google 계정으로 계속"
              disabled={submitting}
              onPress={() => void startGoogleLogin()}
              style={({ pressed }) => [
                styles.googleButton,
                pressed && styles.googleButtonPressed,
                submitting && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.googleMark}>G</Text>
              <Text style={styles.googleText}>Google 계정으로 계속</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="카카오 계정으로 계속"
              disabled={submitting}
              onPress={() => void startRegionalLogin("kakao")}
              style={({ pressed }) => [
                styles.googleButton,
                pressed && styles.googleButtonPressed,
                submitting && styles.buttonDisabled,
              ]}
            >
              <View style={styles.providerMarkBox}>
                <Text style={styles.providerMark}>K</Text>
              </View>
              <Text style={styles.googleText}>카카오 계정으로 계속</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="네이버 계정으로 계속"
              disabled={submitting}
              onPress={() => void startRegionalLogin("naver")}
              style={({ pressed }) => [
                styles.googleButton,
                pressed && styles.googleButtonPressed,
                submitting && styles.buttonDisabled,
              ]}
            >
              <View style={styles.providerMarkBox}>
                <Text style={styles.providerMark}>N</Text>
              </View>
              <Text style={styles.googleText}>네이버 계정으로 계속</Text>
            </Pressable>
          </View>
          {Platform.OS === "ios" ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              cornerRadius={10}
              onPress={() => void signInWithApple()}
              style={styles.appleButton}
            />
          ) : null}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는 이메일</Text>
            <View style={styles.dividerLine} />
          </View>
          <View style={styles.modeRow}>
            {(["login", "register"] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => {
                  setEmailMode(mode);
                  setError(null);
                }}
                style={[styles.modeButton, emailMode === mode && styles.modeButtonActive]}
              >
                <Text style={[styles.modeText, emailMode === mode && styles.modeTextActive]}>
                  {mode === "login" ? "로그인" : "새 계정"}
                </Text>
              </Pressable>
            ))}
          </View>
          {emailMode === "register" ? (
            <TextInput
              autoComplete="name"
              placeholder="닉네임 · 2~30자"
              placeholderTextColor={colors.muted}
              value={displayName}
              onChangeText={setDisplayName}
              style={styles.input}
            />
          ) : null}
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="이메일"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
          <TextInput
            autoCapitalize="none"
            autoComplete={emailMode === "register" ? "new-password" : "current-password"}
            secureTextEntry
            placeholder="비밀번호 · 12자 이상, 영문+숫자"
            placeholderTextColor={colors.muted}
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
          <Pressable
            disabled={
              submitting ||
              !email.includes("@") ||
              password.length < 12 ||
              (emailMode === "register" && displayName.trim().length < 2)
            }
            onPress={() => void submitEmail()}
            style={({ pressed }) => [
              styles.emailButton,
              pressed && styles.googleButtonPressed,
              (submitting ||
                !email.includes("@") ||
                password.length < 12 ||
                (emailMode === "register" && displayName.trim().length < 2)) &&
                styles.buttonDisabled,
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.emailButtonText}>
                {emailMode === "login" ? "이메일로 로그인" : "GROOV 계정 만들기"}
              </Text>
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
          <View style={styles.legalBlock}>
            <Text style={styles.legal}>계속하면 GROOV의 필수 정책에 동의합니다.</Text>
            <View style={styles.legalLinks}>
              <Link href="/legal/terms" style={styles.legalLink}>
                이용약관
              </Link>
              <Link href="/legal/privacy" style={styles.legalLink}>
                개인정보 처리방침
              </Link>
            </View>
          </View>
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
      maxWidth: 448,
      alignSelf: "center",
      paddingHorizontal: 24,
      paddingTop: 22,
      paddingBottom: 34,
      gap: 24,
    },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    brand: {
      color: colors.primary,
      fontSize: 20,
      fontWeight: "900",
      fontStyle: "italic",
      letterSpacing: -0.8,
    },
    edition: { color: colors.muted, fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
    hero: { gap: 10, paddingTop: 18, paddingBottom: 4 },
    kicker: { color: colors.primary, fontSize: 9, fontWeight: "900", letterSpacing: 1.8 },
    title: {
      color: colors.ink,
      fontSize: 40,
      lineHeight: 48,
      fontWeight: "900",
      letterSpacing: -2.2,
    },
    description: { color: colors.muted, fontSize: 13, lineHeight: 20 },
    groovLoop: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      backgroundColor: colors.surface,
      paddingHorizontal: 18,
      paddingVertical: 16,
      gap: 18,
    },
    loopHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    loopEyebrow: { color: colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 1.4 },
    loopPulse: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
    loopSteps: { flexDirection: "row", alignItems: "center" },
    loopStep: { flex: 1, gap: 4 },
    loopIndex: { color: colors.primary, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
    loopTitle: { color: colors.ink, fontSize: 15, fontWeight: "900" },
    loopCaption: { color: colors.muted, fontSize: 8, lineHeight: 12 },
    loopConnector: {
      width: 18,
      height: 1,
      marginHorizontal: 5,
      backgroundColor: colors.border,
    },
    loginCard: {
      gap: 12,
      borderTopWidth: 2,
      borderTopColor: colors.primary,
      borderRadius: 18,
      backgroundColor: colors.surface,
      padding: 18,
    },
    loginHeading: { gap: 5, marginBottom: 4 },
    loginTitle: { color: colors.ink, fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
    loginCaption: { color: colors.muted, fontSize: 10, lineHeight: 16 },
    socialButtons: { gap: 8 },
    googleButton: {
      minHeight: 54,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: "#FFFFFF",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    googleButtonPressed: { transform: [{ scale: 0.99 }], opacity: 0.84 },
    buttonDisabled: { opacity: 0.55 },
    googleMark: { color: colors.primary, fontSize: 18, fontWeight: "900" },
    googleText: { color: "#151515", fontSize: 13, fontWeight: "900" },
    providerMarkBox: {
      width: 21,
      height: 21,
      borderRadius: 11,
      backgroundColor: "#151515",
      alignItems: "center",
      justifyContent: "center",
    },
    providerMark: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
    appleButton: { width: "100%", height: 52 },
    dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 2 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
    dividerText: { color: colors.muted, fontSize: 8, fontWeight: "800" },
    modeRow: {
      flexDirection: "row",
      padding: 3,
      borderRadius: 10,
      backgroundColor: colors.background,
    },
    modeButton: {
      flex: 1,
      minHeight: 38,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    modeButtonActive: { backgroundColor: colors.surface },
    modeText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
    modeTextActive: { color: colors.primary },
    input: {
      minHeight: 50,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.background,
      color: colors.ink,
      fontSize: 12,
      paddingHorizontal: 14,
    },
    emailButton: {
      minHeight: 52,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    emailButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
    error: { color: colors.primary, fontSize: 11, lineHeight: 17, fontWeight: "700" },
    demoButton: { minHeight: 42, alignItems: "center", justifyContent: "center" },
    demoButtonText: { color: colors.muted, fontSize: 9, fontWeight: "800" },
    legalBlock: { gap: 7, marginTop: 4 },
    legal: { color: colors.muted, fontSize: 8, lineHeight: 14 },
    legalLinks: { flexDirection: "row", gap: 14 },
    legalLink: { color: colors.primary, fontSize: 9, fontWeight: "800" },
  });
}
