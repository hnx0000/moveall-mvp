import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/auth/auth-context";
import { ThemeProvider, useAppTheme } from "../src/theme-context";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigation />
    </ThemeProvider>
  );
}

function RootNavigation() {
  const { colors, mode } = useAppTheme();

  return (
    <AuthProvider>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </AuthProvider>
  );
}
