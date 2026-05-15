import { CommonActions } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { usePreferences } from "../preferences/PreferencesContext";
import ListingsScreen from "../screens/ListingsScreen";
import CatalogScreen from "../screens/CatalogScreen";
import HomeScreen from "../screens/HomeScreen";
import ChatsScreen from "../screens/ChatsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import StaffPanelScreen from "../screens/StaffPanelScreen";
import AppTabBar, { hiddenTabOptions } from "./AppTabBar";
import { fonts } from "../theme";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  const { colors } = usePreferences();

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
    }),
    [colors]
  );

  return (
    <Tab.Navigator
      id="AutofinderTabs"
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={screenOptions}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: "Главная", headerShown: false }}
      />
      <Tab.Screen name="Listings" component={ListingsScreen} options={{ title: "Объявления" }} />
      <Tab.Screen
        name="Chats"
        component={ChatsScreen}
        options={{ title: "Чаты", ...hiddenTabOptions() }}
      />
      <Tab.Screen
        name="Garage"
        component={CatalogScreen}
        options={({ navigation }) => ({
          title: "Гараж",
          ...hiddenTabOptions(),
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
        name="Staff"
        component={StaffPanelScreen}
        options={{ title: "Панель", headerShown: false, ...hiddenTabOptions() }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Профиль", ...hiddenTabOptions() }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  headerAdd: { marginRight: 14 },
});
