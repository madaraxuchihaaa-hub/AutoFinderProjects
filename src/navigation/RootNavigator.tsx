import { Ionicons } from "@expo/vector-icons";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import CreateListingScreen from "../screens/CreateListingScreen";
import LoginScreen from "../screens/LoginScreen";
import MainTabs from "./MainTabs";
import PlatformsScreen from "../screens/PlatformsScreen";
import RegisterScreen from "../screens/RegisterScreen";
import SettingsScreen from "../screens/SettingsScreen";
import VehicleDetailScreen from "../screens/VehicleDetailScreen";
import { usePreferences } from "../preferences/PreferencesContext";
import { fonts } from "../theme";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

const HEADER_SIDE = 56;

function HeaderBack({ onPress }: { onPress: () => void }) {
  const { colors } = usePreferences();
  return (
    <Pressable onPress={onPress} hitSlop={12} style={styles.backBtn}>
      <Ionicons name="chevron-back" size={26} color={colors.accent} />
    </Pressable>
  );
}

function HeaderSideSpacer() {
  return <View style={styles.sideSpacer} />;
}

function modalScreenOptions(
  title: string,
  navigation: { goBack: () => void }
): NativeStackNavigationOptions {
  return {
    title,
    presentation: "modal",
    headerTitleAlign: "center",
    headerLeft: () => <HeaderBack onPress={() => navigation.goBack()} />,
    headerRight: () => <HeaderSideSpacer />,
    headerLeftContainerStyle: { width: HEADER_SIDE, minWidth: HEADER_SIDE },
    headerRightContainerStyle: { width: HEADER_SIDE, minWidth: HEADER_SIDE },
    headerTitleContainerStyle: {
      left: HEADER_SIDE,
      right: HEADER_SIDE,
    },
  };
}

export default function RootNavigator() {
  const { ready, token } = useAuth();
  const { colors } = usePreferences();

  if (!ready) {
    return (
      <View style={[styles.boot, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const guest = !token;

  return (
    <Stack.Navigator
      key={guest ? "guest" : "user"}
      id="AutofinderStack"
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgElevated },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      {guest ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ title: "Регистрация" }}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Platforms"
            component={PlatformsScreen}
            options={({ navigation }) => modalScreenOptions("Площадки размещения", navigation)}
          />
          <Stack.Screen
            name="CreateListing"
            component={CreateListingScreen}
            options={({ navigation }) => modalScreenOptions("Новое объявление", navigation)}
          />
          <Stack.Screen
            name="VehicleDetail"
            component={VehicleDetailScreen}
            options={({ navigation }) => ({
              title: "Карточка",
              headerTitleAlign: "center",
              headerLeft: () => <HeaderBack onPress={() => navigation.goBack()} />,
              headerRight: () => <HeaderSideSpacer />,
              headerLeftContainerStyle: { width: HEADER_SIDE, minWidth: HEADER_SIDE },
              headerRightContainerStyle: { width: HEADER_SIDE, minWidth: HEADER_SIDE },
              headerTitleContainerStyle: {
                left: HEADER_SIDE,
                right: HEADER_SIDE,
              },
              headerStyle: {
                backgroundColor: colors.bg,
              },
            })}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={({ navigation }) => modalScreenOptions("Настройки", navigation)}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    width: HEADER_SIDE,
    height: 44,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingLeft: 4,
  },
  sideSpacer: {
    width: HEADER_SIDE,
    height: 44,
  },
});
