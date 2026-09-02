import {
  sportLabels,
  sportValues,
  type ActivityLevel,
  type NeighborhoodVerification,
  type OnboardingGoal,
  type SportType,
} from "@moveall/contracts";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { Check, ChevronLeft, MapPin } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../src/auth/auth-context";
import { saveNeighborhoodPreferences } from "../src/neighborhood-preferences";
import { fonts, type ThemeColors } from "../src/theme";
import { useAppTheme } from "../src/theme-context";

const steps = ["주 운동", "현재 수준", "목표", "동네 인증"] as const;

const levelOptions: Array<{ value: ActivityLevel; label: string; caption: string }> = [
  { value: "starter", label: "이제 시작", caption: "운동 습관을 만드는 중이에요" },
  { value: "steady", label: "꾸준히 운동", caption: "주 1~3회 정도 움직여요" },
  { value: "advanced", label: "기록에 도전", caption: "목표를 세우고 기록을 경신해요" },
];

const goalOptions: Array<{ value: OnboardingGoal; label: string; caption: string }> = [
  { value: "consistency", label: "꾸준한 루틴", caption: "운동을 일상의 습관으로 만들고 싶어요" },
  { value: "fitness", label: "체력 향상", caption: "쉽게 지치지 않는 체력을 기르고 싶어요" },
  { value: "strength", label: "근력 성장", caption: "근력을 키우고 더 탄탄해지고 싶어요" },
  { value: "performance", label: "기록 단축", caption: "내 기록을 조금씩 앞당기고 싶어요" },
  { value: "community", label: "함께 운동", caption: "함께 운동할 사람들을 만나고 싶어요" },
  {
    value: "weight_management",
    label: "체중 관리",
    caption: "나에게 맞는 건강한 체중을 유지하고 싶어요",
  },
];

function neighborhoodFromAddress(address?: Location.LocationGeocodedAddress) {
  if (!address) return "현재 동네";
  const candidates = [address.street, address.district, address.subregion, address.city];
  return (
    candidates.find((value): value is string =>
      Boolean(value && (value.endsWith("동") || value.endsWith("읍") || value.endsWith("면"))),
    ) ??
    address.district ??
    address.city ??
    "현재 동네"
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding, session } = useAuth();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [step, setStep] = useState(0);
  const [primarySports, setPrimarySports] = useState<SportType[]>([]);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [goals, setGoals] = useState<OnboardingGoal[]>([]);
  const [neighborhood, setNeighborhood] = useState<NeighborhoodVerification | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const toggleSport = (sport: SportType) => {
    setMessage(null);
    setPrimarySports((current) => {
      if (current.includes(sport)) return current.filter((item) => item !== sport);
      if (current.length >= 3) {
        setMessage("주 운동은 최대 3개까지 선택할 수 있어요.");
        return current;
      }
      return [...current, sport];
    });
  };

  const toggleGoal = (goal: OnboardingGoal) => {
    setMessage(null);
    setGoals((current) => {
      if (current.includes(goal)) return current.filter((item) => item !== goal);
      if (current.length >= 2) {
        setMessage("지금 가장 중요한 목표 2개만 골라주세요.");
        return current;
      }
      return [...current, goal];
    });
  };

  const canContinue =
    (step === 0 && primarySports.length > 0) ||
    (step === 1 && activityLevel !== null) ||
    (step === 2 && goals.length > 0);

  async function verifyNeighborhood() {
    setVerifying(true);
    setMessage(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setMessage(
          "위치 권한이 없어 인증하지 못했어요. 설정에서 허용하거나 나중에 인증할 수 있어요.",
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const addresses = await Location.reverseGeocodeAsync(position.coords);
      const verifiedAt = new Date().toISOString();
      const next = {
        neighborhood: neighborhoodFromAddress(addresses[0]),
        // 동네 확인에 필요한 수준으로만 좌표를 줄여 정확한 위치 저장을 피합니다.
        latitude: Number(position.coords.latitude.toFixed(2)),
        longitude: Number(position.coords.longitude.toFixed(2)),
        verifiedAt,
      } satisfies NeighborhoodVerification;
      setNeighborhood(next);
      await saveNeighborhoodPreferences({
        neighborhood: next.neighborhood,
        title: "리듬을 만드는",
        verifiedAt,
      });
    } catch {
      setMessage("현재 위치를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setVerifying(false);
    }
  }

  async function finish() {
    if (!activityLevel || primarySports.length === 0 || goals.length === 0) return;
    setSaving(true);
    setMessage(null);
    try {
      await completeOnboarding({
        primarySports,
        activityLevel,
        goals,
        ...(neighborhood ? { neighborhood } : {}),
      });
      router.replace("/");
    } catch {
      setMessage("설정을 저장하지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.shell}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Pressable
              accessibilityLabel={step === 0 ? "첫 단계" : "이전 단계"}
              disabled={step === 0}
              onPress={() => {
                setMessage(null);
                setStep((current) => Math.max(0, current - 1));
              }}
              style={[styles.backButton, step === 0 && styles.backButtonHidden]}
            >
              <ChevronLeft color={colors.ink} size={19} />
            </Pressable>
            <Text style={styles.brand}>GROOV</Text>
            <Text style={styles.stepCount}>
              {step + 1} / {steps.length}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${((step + 1) / steps.length) * 100}%` }]}
            />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>QUICK SETUP · 1분</Text>
          {step === 0 ? (
            <>
              <Text style={styles.title}>
                {session?.user.displayName ?? "회원"}님,{"\n"}주로 어떤 운동을 하나요?
              </Text>
              <Text style={styles.description}>
                홈과 기록 화면을 맞추기 위해 최대 3개만 골라주세요.
              </Text>
              <View style={styles.grid}>
                {sportValues.map((sport) => {
                  const selected = primarySports.includes(sport);
                  return (
                    <Pressable
                      key={sport}
                      onPress={() => toggleSport(sport)}
                      style={[styles.selectCard, selected && styles.selectCardActive]}
                    >
                      <Text style={styles.optionEnglish}>{sport.toUpperCase()}</Text>
                      <Text style={[styles.optionTitle, selected && styles.optionTitleActive]}>
                        {sportLabels[sport]}
                      </Text>
                      <View style={[styles.check, selected && styles.checkActive]}>
                        {selected ? <Check color="#FFFFFF" size={12} strokeWidth={3} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Text style={styles.title}>지금의 운동 수준은{"\n"}어느 쪽에 가까운가요?</Text>
              <Text style={styles.description}>
                현재 운동 습관에 가장 가까운 항목을 선택해주세요.
              </Text>
              <View style={styles.stack}>
                {levelOptions.map((option) => {
                  const selected = activityLevel === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        setActivityLevel(option.value);
                        setMessage(null);
                      }}
                      style={[styles.wideCard, selected && styles.selectCardActive]}
                    >
                      <View style={styles.wideCardCopy}>
                        <Text style={[styles.optionTitle, selected && styles.optionTitleActive]}>
                          {option.label}
                        </Text>
                        <Text style={styles.optionCaption}>{option.caption}</Text>
                      </View>
                      <View style={[styles.radio, selected && styles.radioActive]} />
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={styles.title}>GROOV에서 가장 먼저{"\n"}얻고 싶은 건 뭔가요?</Text>
              <Text style={styles.description}>
                딱 2개까지만. 나머지는 쓰면서 자연스럽게 맞춰갈게요.
              </Text>
              <View style={styles.stack}>
                {goalOptions.map((option) => {
                  const selected = goals.includes(option.value);
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="checkbox"
                      accessibilityLabel={option.label}
                      accessibilityState={{ checked: selected }}
                      onPress={() => toggleGoal(option.value)}
                      style={[styles.wideCard, selected && styles.selectCardActive]}
                    >
                      <View style={styles.wideCardCopy}>
                        <Text style={[styles.optionTitle, selected && styles.optionTitleActive]}>
                          {option.label}
                        </Text>
                        <Text style={styles.optionCaption}>{option.caption}</Text>
                      </View>
                      <View
                        style={[styles.radio, styles.goalCheck, selected && styles.checkActive]}
                      >
                        {selected ? <Check color="#FFFFFF" size={12} strokeWidth={3} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={styles.title}>마지막으로,{"\n"}내 동네를 연결할까요?</Text>
              <Text style={styles.description}>
                동네 메달과 시즌 기록에 참여할 때 사용해요. 인증은 30일 동안 유지됩니다.
              </Text>
              <View style={[styles.locationCard, neighborhood && styles.locationCardVerified]}>
                <View style={styles.locationIcon}>
                  {neighborhood ? (
                    <Check color="#FFFFFF" size={22} strokeWidth={3} />
                  ) : (
                    <MapPin color="#FFFFFF" size={22} />
                  )}
                </View>
                <View style={styles.locationCopy}>
                  <Text style={styles.locationLabel}>
                    {neighborhood ? "동네 인증 완료" : "현재 위치로 동네 인증"}
                  </Text>
                  <Text style={styles.locationValue}>
                    {neighborhood?.neighborhood ?? "정확한 주소 대신 동네 단위로만 저장해요"}
                  </Text>
                </View>
              </View>
              <Text style={styles.privacyNote}>
                GPS는 인증 순간에만 사용하고, 저장 좌표는 동네 수준으로 낮춰 보관합니다.
              </Text>
            </>
          ) : null}

          {message ? <Text style={styles.message}>{message}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          {step < 3 ? (
            <Pressable
              disabled={!canContinue}
              onPress={() => {
                setMessage(null);
                setStep((current) => current + 1);
              }}
              style={[styles.primaryButton, !canContinue && styles.disabled]}
            >
              <Text style={styles.primaryButtonText}>다음</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                disabled={saving || verifying}
                onPress={() => (neighborhood ? void finish() : void verifyNeighborhood())}
                style={[styles.primaryButton, (saving || verifying) && styles.disabled]}
              >
                {saving || verifying ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {neighborhood ? "GROOV 시작하기" : "동네 인증하기"}
                  </Text>
                )}
              </Pressable>
              {!neighborhood ? (
                <Pressable
                  disabled={saving}
                  onPress={() => void finish()}
                  style={styles.skipButton}
                >
                  <Text style={styles.skipText}>동네 인증은 나중에</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    shell: { flex: 1, width: "100%", maxWidth: 448, alignSelf: "center" },
    header: { paddingHorizontal: 24, paddingTop: 18, gap: 14 },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    backButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
    backButtonHidden: { opacity: 0 },
    brand: {
      color: colors.primary,
      fontFamily: fonts.displayItalic,
      fontSize: 18,
      fontStyle: "italic",
    },
    stepCount: {
      width: 34,
      color: colors.muted,
      fontFamily: fonts.display,
      fontSize: 9,
      textAlign: "right",
    },
    progressTrack: {
      height: 3,
      borderRadius: 2,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    progressFill: { height: "100%", borderRadius: 2, backgroundColor: colors.primary },
    content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 38, paddingBottom: 24 },
    eyebrow: {
      color: colors.primary,
      fontFamily: fonts.display,
      fontSize: 9,
      letterSpacing: 1.5,
      marginBottom: 13,
    },
    title: {
      color: colors.ink,
      fontFamily: fonts.bold,
      fontSize: 28,
      lineHeight: 38,
      letterSpacing: -1.2,
    },
    description: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 19,
      marginTop: 11,
      marginBottom: 28,
    },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    selectCard: {
      width: "48%",
      minHeight: 106,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      backgroundColor: colors.surface,
      padding: 15,
      justifyContent: "flex-end",
      gap: 5,
    },
    selectCardActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    optionEnglish: {
      color: colors.muted,
      fontFamily: fonts.display,
      fontSize: 7,
      letterSpacing: 1,
    },
    optionTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
    optionTitleActive: { color: colors.primary },
    optionCaption: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 4,
    },
    check: {
      position: "absolute",
      right: 12,
      top: 12,
      width: 21,
      height: 21,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    checkActive: { borderColor: colors.primary, backgroundColor: colors.primary },
    stack: { gap: 10 },
    wideCard: {
      minHeight: 78,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      backgroundColor: colors.surface,
      paddingHorizontal: 17,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    wideCardCopy: { flex: 1 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border },
    radioActive: { borderWidth: 6, borderColor: colors.primary },
    goalCheck: { alignItems: "center", justifyContent: "center" },
    locationCard: {
      minHeight: 112,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      backgroundColor: colors.surface,
      padding: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    locationCardVerified: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    locationIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    locationCopy: { flex: 1, gap: 5 },
    locationLabel: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
    locationValue: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10, lineHeight: 16 },
    privacyNote: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 9,
      lineHeight: 15,
      marginTop: 13,
    },
    message: {
      color: colors.primary,
      fontFamily: fonts.semibold,
      fontSize: 10,
      lineHeight: 16,
      marginTop: 18,
    },
    footer: {
      paddingHorizontal: 24,
      paddingTop: 10,
      paddingBottom: 26,
      gap: 5,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    primaryButton: {
      minHeight: 56,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 14 },
    skipButton: { minHeight: 42, alignItems: "center", justifyContent: "center" },
    skipText: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 10 },
    disabled: { opacity: 0.35 },
  });
}
