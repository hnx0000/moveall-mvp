import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { Platform } from "react-native";
import { darkColors, lightColors, type ThemeColors } from "./theme";

type ColorMode = "light" | "dark";

type ThemeContextValue = {
  colors: ThemeColors;
  mode: ColorMode;
  setMode(mode: ColorMode): void;
  toggleMode(): void;
};

const storageKey = "moveall-color-mode";
const ThemeContext = createContext<ThemeContextValue | null>(null);

async function readMode(): Promise<ColorMode> {
  const value =
    Platform.OS === "web"
      ? globalThis.localStorage?.getItem(storageKey)
      : await SecureStore.getItemAsync(storageKey);
  return value === "light" ? "light" : "dark";
}

async function persistMode(mode: ColorMode): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(storageKey, mode);
    return;
  }
  await SecureStore.setItemAsync(storageKey, mode);
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, updateMode] = useState<ColorMode>("dark");

  useEffect(() => {
    void readMode().then(updateMode);
  }, []);

  const setMode = useCallback((nextMode: ColorMode) => {
    updateMode(nextMode);
    void persistMode(nextMode);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: mode === "dark" ? darkColors : lightColors,
      mode,
      setMode,
      toggleMode: () => setMode(mode === "dark" ? "light" : "dark"),
    }),
    [mode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useAppTheme must be used inside ThemeProvider");
  return value;
}
