import { NavigationContainer, DarkTheme, Theme } from "@react-navigation/native";
import { useEffect } from "react";
import { ActivityIndicator, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAppFonts } from "./fonts";
import { AuthProvider } from "./auth/AuthContext";
import RootNavigator from "./navigation/RootNavigator";
import { colors } from "./theme";

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.bg,
    card: colors.bgElevated,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};

export default function App() {
  const [loaded, err] = useAppFonts();

  useEffect(() => {
    if (err) console.warn(err);
  }, [err]);

  if (!loaded) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar barStyle="light-content" />
        <NavigationContainer theme={navTheme}>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
});
