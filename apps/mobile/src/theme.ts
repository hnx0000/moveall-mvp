export const lightColors = {
  background: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceMuted: "#F6F6F5",
  primary: "#FF5A24",
  primaryDark: "#D94514",
  primarySoft: "#FFF0EA",
  hero: "#171719",
  accent: "#FF5A24",
  ink: "#151516",
  muted: "#747470",
  border: "#E9E9E7",
  danger: "#B42318",
  warning: "#94530A",
  map: "#F0EEE9",
  mapLine: "#DEDAD2",
  tab: "#FFFFFF",
} as const;

export type ThemeColors = { [Key in keyof typeof lightColors]: string };

export const darkColors: ThemeColors = {
  background: "#0B0B0C",
  surface: "#131315",
  surfaceMuted: "#1B1B1E",
  primary: "#FF622E",
  primaryDark: "#FF784D",
  primarySoft: "#3A1E15",
  hero: "#1B1B1D",
  accent: "#FF622E",
  ink: "#F7F6F2",
  muted: "#A4A49F",
  border: "#28282B",
  danger: "#FF7B70",
  warning: "#F0AF57",
  map: "#202023",
  mapLine: "#36363A",
  tab: "#141416",
};

// 정적 스타일이 필요한 비화면 코드의 하위 호환용입니다.
export const colors = lightColors;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
