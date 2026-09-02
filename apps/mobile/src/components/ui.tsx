import type { PropsWithChildren, ReactNode } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { Bell } from "lucide-react-native";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  fonts,
  gradients,
  maxContentWidth,
  radius,
  shadows,
  space,
  typography,
  type ThemeColors,
} from "../theme";
import { useAppTheme } from "../theme-context";
import { RefreshableScrollView } from "./refreshable-scroll-view";

export function Screen({
  children,
  title,
  subtitle,
  action,
  onRefresh,
  refreshing,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  action?: ReactNode;
  onRefresh?: () => Promise<void>;
  refreshing?: boolean;
}>) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.frame}>
        <View style={styles.appHeader}>
          <Wordmark />
          {action ? <View style={styles.headerAction}>{action}</View> : null}
        </View>
        <RefreshableScrollView
          {...(onRefresh ? { onRefresh, refreshing: Boolean(refreshing) } : {})}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {title ? (
            <View style={styles.headingText}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          ) : null}
          {children}
        </RefreshableScrollView>
      </View>
    </SafeAreaView>
  );
}

export function Wordmark({ size = 20 }: { size?: number }) {
  const { colors } = useAppTheme();
  return <Text style={[typography.wordmark(size), { color: colors.primary }]}>GROOV</Text>;
}

type AppTextProps = TextProps & { size?: number; color?: string };

export function TitleText({ size = 16, color, style, ...props }: AppTextProps) {
  const { colors } = useAppTheme();
  return (
    <Text {...props} style={[typography.title(size), { color: color ?? colors.ink }, style]} />
  );
}

export function BodyText({ size = 14, color, style, ...props }: AppTextProps) {
  const { colors } = useAppTheme();
  return <Text {...props} style={[typography.body(size), { color: color ?? colors.ink }, style]} />;
}

export function MutedText({ size = 12, style, ...props }: AppTextProps) {
  const { colors } = useAppTheme();
  return <Text {...props} style={[typography.body(size), { color: colors.muted }, style]} />;
}

export function NumericText({ size = 24, color, style, ...props }: AppTextProps) {
  const { colors } = useAppTheme();
  return (
    <Text {...props} style={[typography.numeric(size), { color: color ?? colors.ink }, style]} />
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ children }: PropsWithChildren) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Divider() {
  const { colors } = useAppTheme();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

export function BellButton({
  onPress,
  label = "알림 확인",
}: {
  onPress: () => void;
  label?: string;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
    >
      <Bell color={colors.ink} size={22} strokeWidth={2} />
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  disabled,
  style,
  ...props
}: PressableProps & { label: string }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(state) => [
        styles.buttonShell,
        shadows.pop,
        state.pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
        typeof style === "function" ? style(state) : style,
      ]}
      {...props}
    >
      <LinearGradient
        colors={gradients.primary.colors}
        start={gradients.primary.start}
        end={gradients.primary.end}
        style={styles.button}
      >
        <Text style={styles.buttonText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export function StatePanel({
  state,
  message,
  onRetry,
}: {
  state: "loading" | "empty" | "error";
  message: string;
  onRetry?: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <Card>
      <View style={styles.statePanel}>
        {state === "loading" ? <ActivityIndicator color={colors.primary} /> : null}
        <Text style={[styles.stateMessage, state === "error" && styles.errorText]}>{message}</Text>
        {state === "error" && onRetry ? (
          <PrimaryButton label="다시 시도" onPress={onRetry} />
        ) : null}
      </View>
    </Card>
  );
}

export function CenterDialog({
  visible,
  eyebrow = "GROOV NOTICE",
  title,
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  busy = false,
  danger = false,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  eyebrow?: string;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  danger?: boolean;
  onClose: () => void;
  onConfirm?: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View accessibilityViewIsModal style={styles.dialogBackdrop}>
        <View style={styles.dialogCard}>
          <Text style={[styles.dialogEyebrow, danger && styles.dialogEyebrowDanger]}>
            {eyebrow}
          </Text>
          <Text style={styles.dialogTitle}>{title}</Text>
          {message ? <Text style={styles.dialogMessage}>{message}</Text> : null}
          <View style={styles.dialogActions}>
            {onConfirm ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.dialogSecondary,
                  pressed && styles.buttonPressed,
                  busy && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.dialogSecondaryText}>{cancelLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onConfirm ?? onClose}
              style={({ pressed }) => [
                styles.dialogPrimary,
                danger && styles.dialogPrimaryDanger,
                pressed && styles.buttonPressed,
                busy && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.dialogPrimaryText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    frame: {
      flex: 1,
      width: "100%",
      maxWidth: maxContentWidth,
      alignSelf: "center",
      backgroundColor: colors.background,
    },
    scroll: { flex: 1 },
    content: {
      width: "100%",
      paddingHorizontal: space[5],
      paddingTop: space[3],
      paddingBottom: 108,
      gap: space[4],
    },
    appHeader: {
      minHeight: 60,
      paddingHorizontal: space[5],
      paddingVertical: space[3],
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    headerAction: { minWidth: 34, alignItems: "flex-end" },
    headingText: { gap: 5, marginBottom: space[1] },
    title: {
      color: colors.ink,
      fontFamily: fonts.bold,
      fontSize: 24,
      lineHeight: 32,
      letterSpacing: -0.5,
    },
    subtitle: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 19,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.xl,
      padding: space[4],
      ...shadows.card,
    },
    sectionTitle: {
      color: colors.ink,
      fontFamily: fonts.bold,
      fontSize: 17,
      lineHeight: 24,
      marginTop: space[2],
    },
    chip: {
      minHeight: 36,
      paddingHorizontal: space[4],
      paddingVertical: space[2],
      borderRadius: radius.full,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 13 },
    chipTextActive: { color: "#FFFFFF" },
    buttonShell: { borderRadius: radius.md, overflow: "hidden" },
    button: {
      minHeight: 50,
      paddingHorizontal: space[5],
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
    buttonDisabled: { opacity: 0.45 },
    buttonText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 15 },
    headerButton: {
      width: 38,
      height: 38,
      borderRadius: radius.full,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: { opacity: 0.7 },
    statePanel: { gap: space[4], alignItems: "center", paddingVertical: space[4] },
    stateMessage: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 13,
      textAlign: "center",
      lineHeight: 21,
    },
    errorText: { color: colors.danger },
    dialogBackdrop: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.76)",
      padding: 20,
    },
    dialogCard: {
      width: "100%",
      maxWidth: 400,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 20,
      gap: 11,
      ...shadows.card,
    },
    dialogEyebrow: {
      color: colors.primary,
      fontFamily: fonts.bold,
      fontSize: 8,
      letterSpacing: 0.8,
    },
    dialogEyebrowDanger: { color: colors.danger },
    dialogTitle: {
      color: colors.ink,
      fontFamily: fonts.displayExtra,
      fontSize: 20,
      lineHeight: 27,
    },
    dialogMessage: {
      color: colors.muted,
      fontFamily: fonts.regular,
      fontSize: 11,
      lineHeight: 18,
    },
    dialogActions: { flexDirection: "row", gap: 8, marginTop: 3 },
    dialogSecondary: {
      minWidth: 78,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dialogSecondaryText: { color: colors.muted, fontFamily: fonts.bold, fontSize: 10 },
    dialogPrimary: {
      flex: 1,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.md,
      backgroundColor: colors.primary,
    },
    dialogPrimaryDanger: { backgroundColor: colors.danger },
    dialogPrimaryText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 10 },
  });
}
