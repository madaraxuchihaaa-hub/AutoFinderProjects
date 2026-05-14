import { CommonActions } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Platform, Pressable, StyleSheet } from "react-native";
import AggregatedScreen from "../screens/AggregatedScreen";
import CatalogScreen from "../screens/CatalogScreen";
import HomeScreen from "../screens/HomeScreen";
import ProfileScreen from "../screens/ProfileScreen";
import QueueScreen from "../screens/QueueScreen";
import { colors, fonts } from "../theme";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  return (
    <Tab.Navigator
      id="AutofinderTabs"
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgElevated },
        headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: "Главная",
          tabBarLabel: "Главная",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" color={color} size={size} />
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
            <Ionicons name="globe-outline" color={color} size={size} />
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
            <Ionicons name="car-sport" color={color} size={size} />
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
          title: "Автопостинг",
          tabBarLabel: "Очередь",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flash" color={color} size={size} />
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
            <Ionicons name="person-circle-outline" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  headerAdd: { marginRight: 14 },
});
