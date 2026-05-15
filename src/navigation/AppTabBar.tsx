import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { CommonActions } from "@react-navigation/native";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePreferences } from "../preferences/PreferencesContext";
import { fonts, radii, spacing } from "../theme";
import AppMenuSheet from "./AppMenuSheet";

export default function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, t } = usePreferences();
  const [menuOpen, setMenuOpen] = useState(false);
  const padBottom = Math.max(insets.bottom + 6, Platform.OS === "android" ? 22 : 10);
  const activeRoute = state.routes[state.index]?.name;

  function go(name: string) {
    const idx = state.routes.findIndex((r) => r.name === name);
    if (idx >= 0) {
      navigation.navigate(state.routes[idx].name);
    }
  }

  const styles = makeStyles(colors, padBottom);

  return (
    <>
      <View style={styles.bar}>
        <TabBtn
          active={activeRoute === "Home"}
          label={t("tabHome")}
          icon="home"
          onPress={() => go("Home")}
          colors={colors}
        />
        <TabBtn
          active={activeRoute === "Market"}
          label={t("tabMarket")}
          icon="globe-outline"
          onPress={() => go("Market")}
          colors={colors}
        />
        <TabBtn
          active={activeRoute === "Chats"}
          label={t("tabChats")}
          icon="chatbubbles-outline"
          onPress={() => go("Chats")}
          colors={colors}
        />
        <TabBtn
          active={menuOpen}
          label={t("tabMenu")}
          icon="menu"
          onPress={() => setMenuOpen(true)}
          colors={colors}
        />
      </View>
      <AppMenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigateGarage={() => {
          setMenuOpen(false);
          go("Garage");
        }}
        onNavigateProfile={() => {
          setMenuOpen(false);
          go("Profile");
        }}
        onNavigateStaff={() => {
          setMenuOpen(false);
          go("Staff");
        }}
        onNavigateCreate={() => {
          setMenuOpen(false);
          navigation.getParent()?.dispatch(CommonActions.navigate({ name: "CreateListing" }));
        }}
        onNavigatePlatforms={() => {
          setMenuOpen(false);
          navigation.getParent()?.dispatch(CommonActions.navigate({ name: "Platforms" }));
        }}
        onNavigateSettings={() => {
          setMenuOpen(false);
          navigation.getParent()?.dispatch(CommonActions.navigate({ name: "Settings" }));
        }}
      />
    </>
  );
}

function TabBtn({
  active,
  label,
  icon,
  onPress,
  colors,
}: {
  active: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  colors: ReturnType<typeof usePreferences>["colors"];
}) {
  return (
    <Pressable onPress={onPress} style={stylesTab.btn} hitSlop={8}>
      <Ionicons name={icon} size={24} color={active ? colors.accent : colors.textMuted} />
      <Text style={[stylesTab.label, { color: active ? colors.accent : colors.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const stylesTab = StyleSheet.create({
  btn: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 6 },
  label: { fontFamily: fonts.medium, fontSize: 11, marginTop: 2 },
});

function makeStyles(colors: ReturnType<typeof usePreferences>["colors"], padBottom: number) {
  return StyleSheet.create({
    bar: {
      flexDirection: "row",
      backgroundColor: colors.bgElevated,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingBottom: padBottom,
      paddingTop: 6,
      minHeight: 52 + padBottom,
      elevation: 12,
    },
  });
}

/** Скрывает лишние вкладки из стандартного tab bar (не используется при кастомном bar). */
export function hiddenTabOptions() {
  return {
    tabBarButton: () => null,
  } as const;
}
