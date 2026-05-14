import { CommonActions } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useMemo } from "react";
import { Platform, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AggregatedScreen from "../screens/AggregatedScreen";
import CatalogScreen from "../screens/CatalogScreen";
import HomeScreen from "../screens/HomeScreen";
import ProfileScreen from "../screens/ProfileScreen";
import QueueScreen from "../screens/QueueScreen";
import { colors, fonts } from "../theme";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

/** На Android с жестовой навигацией insets.bottom часто 0 — добавляем запас над системной полосой. */
function tabBarBottomPadding(insetsBottom: number): number {
  const minAndroid = Platform.OS === "android" ? 22 : 10;
  return Math.max(insetsBottom + 6, minAndroid);
}

export default function MainTabs() {
  const insets = useSafeAreaInsets();
  const padBottom = tabBarBottomPadding(insets.bottom);
  const barHeight = 52 + padBottom;

  const screenOptions = useMemo(
    () => ({
      headerStyle: {
        backgroundColor: colors.bgElevated,
        elevation: 0,
        shadowOpacity: 0,
      },
      headerTitleStyle: {
        fontFamily: fonts.semibold,
        fontSize: 17,
        color: colors.text,
      },
      headerShadowVisible: false,
      tabBarHideOnKeyboard: true,
      tabBarStyle: {
        backgroundColor: colors.bgElevated,
        borderTopColor: colors.border,
        borderTopWidth: StyleSheet.hairlineWidth,
        height: barHeight,
        paddingBottom: padBottom,
        paddingTop: 6,
        elevation: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarLabelStyle: {
        fontFamily: fonts.medium,
        fontSize: 11,
        marginTop: -2,
        marginBottom: 0,
      },
      tabBarIconStyle: { marginTop: 2 },
      tabBarItemStyle: Platform.OS === "android" ? { paddingVertical: 0 } : undefined,
    }),
    [barHeight, padBottom]
  );

  return (
    <Tab.Navigator id="AutofinderTabs" screenOptions={screenOptions}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: "Главная",
          tabBarLabel: "Главная",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" color={color} size={size + (Platform.OS === "android" ? 1 : 0)} />
          ),
        }}
      />
      <Tab.Screen
        name="Market"
        component={AggregatedScreen}
        options={{
          title: "Рынок",
          tabBarLabel: "Рынок",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="globe-outline" color={color} size={size + (Platform.OS === "android" ? 1 : 0)} />
          ),
        }}
      />
      <Tab.Screen
        name="Garage"
        component={CatalogScreen}
        options={({ navigation }) => ({
          title: "Гараж",
          tabBarLabel: "Гараж",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="car-sport" color={color} size={size + (Platform.OS === "android" ? 1 : 0)} />
          ),
          headerRight: () => (
            <Pressable
              hitSlop={12}
              style={styles.headerAdd}
              onPress={() =>
                navigation
                  .getParent()
                  ?.dispatch(CommonActions.navigate({ name: "CreateListing" }))
              }
            >
              <Ionicons name="add-circle" size={28} color={colors.accent} />
            </Pressable>
          ),
        })}
      />
      <Tab.Screen
        name="Automation"
        component={QueueScreen}
        options={{
          title: "Очередь",
          tabBarLabel: "Очередь",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flash" color={color} size={size + (Platform.OS === "android" ? 1 : 0)} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Профиль",
          tabBarLabel: "Профиль",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" color={color} size={size + (Platform.OS === "android" ? 1 : 0)} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  headerAdd: { marginRight: 14 },
});
