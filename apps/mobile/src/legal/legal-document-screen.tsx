import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { fonts, maxContentWidth, type ThemeColors } from "../theme";
import { useAppTheme } from "../theme-context";
import { POLICY_VERSION, type PolicySection } from "./policies";

export function LegalDocumentScreen({
  eyebrow,
  title,
  sections,
}: {
  eyebrow: string;
  title: string;
  sections: PolicySection[];
}) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <Pressable accessibilityLabel="뒤로" onPress={() => router.back()} style={styles.back}>
          <ChevronLeft color={colors.ink} size={22} />
        </Pressable>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.version}>시행 예정 {POLICY_VERSION} · 출시 전 검토 초안</Text>
        </View>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.paragraphs.map((paragraph) => (
              <Text key={paragraph} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    page: {
      width: "100%",
      maxWidth: maxContentWidth,
      alignSelf: "center",
      paddingHorizontal: 24,
      paddingTop: 18,
      paddingBottom: 64,
      gap: 26,
    },
    back: { width: 42, height: 42, justifyContent: "center" },
    hero: { gap: 8, paddingBottom: 20, borderBottomWidth: 1, borderColor: colors.border },
    eyebrow: {
      color: colors.primary,
      fontFamily: fonts.displayExtra,
      fontSize: 10,
      letterSpacing: 1.4,
    },
    title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 32, letterSpacing: -1.2 },
    version: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11 },
    section: { gap: 10 },
    sectionTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17 },
    paragraph: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 22 },
  });
}
