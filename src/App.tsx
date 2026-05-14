import { ActivityIndicator, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";
import { useAppFonts } from "./fonts";
import MobileShell from "./screens/MobileShell";
import { colors } from "./theme";

export default function App() {
  const [loaded, err] = useAppFonts();

  useEffect(() => {
    if (err) console.warn(err);
  }, [err]);

  if (!loaded) {
    return (
      <View style={styles.boot}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <MobileShell />
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
