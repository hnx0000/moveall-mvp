import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { spacing, type ThemeColors } from "../theme";
import { useAppTheme } from "../theme-context";

export function Screen({
  children,
  title,
  subtitle,
  action,
}: PropsWithChildren<{ title: string; subtitle?: string; action?: ReactNode }>) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.appHeader}>
          <Text style={styles.eyebrow}>MOVEALL</Text>
          {action}
        </View>
        {title ? (
          <View style={styles.headingText}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: PropsWithChildren) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return <Text style={styles.sectionTitle}>{children}</Text>;
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
      onPress={onPress}
      style={styles.headerButton}
    >
      <View style={styles.bellBody} />
      <View style={styles.bellClapper} />
    </Pressable>
  );
}

export function PrimaryButton({ label, disabled, ...props }: PressableProps & { label: string }) {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
      {...props}
    >
      <Text style={styles.buttonText}>{label}</Text>
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: {
      width: "100%",
      maxWidth: 760,
      alignSelf: "center",
      padding: 20,
      paddingBottom: 104,
      gap: 16,
    },
    appHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 28,
      marginBottom: 2,
    },
    headingText: { flex: 1 },
    eyebrow: {
      color: colors.primary,
      fontSize: 15,
      fontStyle: "italic",
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    title: { color: colors.ink, fontSize: 22, lineHeight: 28, fontWeight: "900" },
    subtitle: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 9,
      padding: spacing.md,
    },
    sectionTitle: {
      color: colors.ink,
      fontWeight: "900",
      fontSize: 16,
      marginTop: spacing.sm,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 9,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      alignItems: "center",
    },
    buttonPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
    buttonDisabled: { opacity: 0.45 },
    buttonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 15 },
    headerButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
    bellBody: {
      width: 14,
      height: 15,
      borderWidth: 1.4,
      borderColor: colors.ink,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      borderBottomLeftRadius: 3,
      borderBottomRightRadius: 3,
    },
    bellClapper: {
      width: 4,
      height: 2,
      borderRadius: 2,
      backgroundColor: colors.ink,
      marginTop: 2,
    },
    statePanel: { gap: spacing.md, alignItems: "center", paddingVertical: spacing.md },
    stateMessage: { color: colors.muted, textAlign: "center", lineHeight: 21 },
    errorText: { color: colors.danger },
  });
}
