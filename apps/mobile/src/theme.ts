import { Platform, type TextStyle, type ViewStyle } from "react-native";

/**
 * GROOV 디자인 토큰.
 * moveall-design-export의 색상/간격/타이포그래피를 기존 테마 전환 구조에 맞게 통합합니다.
 */
export const lightColors = {
  background: "#FDFBF9",
  surface: "#FFFFFF",
  surfaceMuted: "#F6F4F1",
  primary: "#FE3917",
  primaryDark: "#D8380F",
  primarySoft: "#FDEDE6",
  hero: "#282320",
  accent: "#FE3917",
  ink: "#2B2723",
  muted: "#847B72",
  border: "#E9E6E2",
  danger: "#FE3917",
  warning: "#FE3917",
  map: "#F2F5F0",
  mapLine: "#E8ECE6",
  tab: "#FDFBF9",
} as const;

export type ThemeColors = { [Key in keyof typeof lightColors]: string };

export const darkColors: ThemeColors = {
  background: "#0E0D0C",
  surface: "#171513",
  surfaceMuted: "#211E1B",
  primary: "#FF5A32",
  primaryDark: "#FF7655",
  primarySoft: "#3A1C13",
  hero: "#211E1B",
  accent: "#FF5A32",
  ink: "#FAF8F6",
  muted: "#AAA097",
  border: "#302C28",
  danger: "#FF5A32",
  warning: "#FF5A32",
  map: "#211F1C",
  mapLine: "#36322E",
  tab: "#171513",
};

export const colors = lightColors;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
} as const;

export const radius = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 18,
  "2xl": 22,
  "3xl": 26,
  full: 999,
} as const;

export const maxContentWidth = 448;

export const fonts = {
  regular: "NotoSansKR_400Regular",
  medium: "NotoSansKR_500Medium",
  semibold: "NotoSansKR_600SemiBold",
  bold: "NotoSansKR_700Bold",
  display: "Archivo_700Bold",
  displayExtra: "Archivo_800ExtraBold",
  displayItalic: "Archivo_800ExtraBold_Italic",
} as const;

const tracking = (size: number, em: number) => size * em;

export const typography = {
  numeric: (size: number): TextStyle => ({
    fontFamily: fonts.display,
    fontSize: size,
    letterSpacing: tracking(size, -0.045),
    ...Platform.select({ web: { fontVariantNumeric: "tabular-nums" } as TextStyle, default: {} }),
  }),
  wordmark: (size: number): TextStyle => ({
    fontFamily: fonts.displayItalic,
    fontSize: size,
    fontStyle: "italic",
    letterSpacing: tracking(size, -0.03),
  }),
  title: (size: number): TextStyle => ({
    fontFamily: fonts.bold,
    fontSize: size,
    letterSpacing: tracking(size, -0.01),
  }),
  body: (size = 14): TextStyle => ({
    fontFamily: fonts.regular,
    fontSize: size,
    letterSpacing: tracking(size, -0.01),
  }),
  semibold: (size = 14): TextStyle => ({
    fontFamily: fonts.semibold,
    fontSize: size,
    letterSpacing: tracking(size, -0.01),
  }),
} as const;

function shadow(
  offsetY: number,
  radiusPx: number,
  opacity: number,
  color: string,
  elevation: number,
): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0 ${offsetY}px ${radiusPx}px rgba(43,39,35,${opacity})` } as ViewStyle,
    default: {
      shadowColor: color,
      shadowOffset: { width: 0, height: offsetY },
      shadowRadius: radiusPx,
      shadowOpacity: opacity,
      elevation,
    },
  })!;
}

export const shadows = {
  card: shadow(8, 24, 0.06, "#2B2723", 3),
  pop: Platform.select<ViewStyle>({
    web: { boxShadow: "0 8px 24px rgba(254,57,23,0.30)" } as ViewStyle,
    default: {
      shadowColor: "#FE3917",
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 24,
      shadowOpacity: 0.3,
      elevation: 6,
    },
  })!,
} as const;

export const gradients = {
  primary: {
    colors: ["#FF5A24", "#F02A0C"] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  imageOverlay: {
    colors: ["rgba(0,0,0,0)", "rgba(0,0,0,0.72)"] as const,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
} as const;
