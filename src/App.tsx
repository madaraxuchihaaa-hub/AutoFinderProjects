import { NavigationContainer, DarkTheme, DefaultTheme, Theme } from "@react-navigation/native";
import { useEffect, useMemo } from "react";
import { ActivityIndicator, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAppFonts } from "./fonts";
import { AuthProvider } from "./auth/AuthContext";
import { PreferencesProvider, usePreferences } from "./preferences/PreferencesContext";
import RootNavigator from "./navigation/RootNavigator";

function AppNavigation({
  fontsLoaded,
  fontErr,
}: {
  fontsLoaded: boolean;
  fontErr: Error | null;
}) {
  const { ready: prefsReady, colors, theme } = usePreferences();

  useEffect(() => {
    if (fontErr) console.warn(fontErr);
  }, [fontErr]);

  const navTheme: Theme = useMemo(
    () => ({
      ...(theme === "dark" ? DarkTheme : DefaultTheme),
      colors: {
        ...(theme === "dark" ? DarkTheme.colors : DefaultTheme.colors),
        primary: colors.accent,
        background: colors.bg,
        card: colors.bgElevated,
        text: colors.text,
        border: colors.border,
        notification: colors.accent,
      },
    }),
    [theme, colors]
  );

  if (!fontsLoaded || !prefsReady) {
    return (
      <View style={[styles.boot, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />
      <NavigationContainer theme={navTheme}>
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}

export default function App() {
  const [fontsLoaded, fontErr] = useAppFonts();

  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <AuthProvider>
          <AppNavigation fontsLoaded={fontsLoaded} fontErr={fontErr} />
        </AuthProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
