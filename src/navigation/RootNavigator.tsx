import { Ionicons } from "@expo/vector-icons";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import CreateListingScreen from "../screens/CreateListingScreen";
import LoginScreen from "../screens/LoginScreen";
import MainTabs from "./MainTabs";
import PlatformsScreen from "../screens/PlatformsScreen";
import RegisterScreen from "../screens/RegisterScreen";
import VehicleDetailScreen from "../screens/VehicleDetailScreen";
import { colors, fonts } from "../theme";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

function HeaderBack({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} style={styles.backBtn}>
      <Ionicons name="chevron-back" size={22} color={colors.accent} />
      <Text style={styles.backText}>Назад</Text>
    </Pressable>
  );
}

export default function RootNavigator() {
  const { ready, token } = useAuth();

  if (!ready) {
    return (
      <View style={styles.boot}>
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
        headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17 },
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
            options={({ navigation }) => ({
              title: "Площадки размещения",
              presentation: "modal",
              headerLeft: () => (
                <HeaderBack onPress={() => navigation.goBack()} />
              ),
            })}
          />
          <Stack.Screen
            name="CreateListing"
            component={CreateListingScreen}
            options={({ navigation }) => ({
              title: "Новое объявление",
              presentation: "modal",
              headerLeft: () => (
                <HeaderBack onPress={() => navigation.goBack()} />
              ),
            })}
          />
          <Stack.Screen
            name="VehicleDetail"
            component={VehicleDetailScreen}
            options={({ navigation }) => ({
              title: "Карточка",
              headerLeft: () => (
                <HeaderBack onPress={() => navigation.goBack()} />
              ),
              headerStyle: {
                backgroundColor: colors.bg,
              },
            })}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginLeft: -4,
  },
  backText: {
    color: colors.accent,
    fontFamily: fonts.medium,
    fontSize: 16,
  },
});
