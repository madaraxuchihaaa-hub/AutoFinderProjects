import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { usePreferences } from "../preferences/PreferencesContext";
import type { RootStackParamList } from "../navigation/types";
import { fonts, radii, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export default function SettingsScreen(_props: Props) {
  const { colors, theme, locale, setTheme, setLocale, t } = usePreferences();
  const styles = makeStyles(colors);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Text style={styles.section}>{t("theme")}</Text>
      <View style={styles.row}>
        <Choice
          active={theme === "dark"}
          label={t("themeDark")}
          icon="moon-outline"
          onPress={() => setTheme("dark")}
          styles={styles}
        />
        <Choice
          active={theme === "light"}
          label={t("themeLight")}
          icon="sunny-outline"
          onPress={() => setTheme("light")}
          styles={styles}
        />
      </View>
      <Text style={styles.section}>{t("language")}</Text>
      <View style={styles.row}>
        <Choice
          active={locale === "ru"}
          label={t("langRu")}
          onPress={() => setLocale("ru")}
          styles={styles}
        />
        <Choice
          active={locale === "en"}
          label={t("langEn")}
          onPress={() => setLocale("en")}
          styles={styles}
        />
      </View>
    </ScrollView>
  );
}

function Choice({
  active,
  label,
  icon,
  onPress,
  styles,
}: {
  active: boolean;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.choice, active && styles.choiceOn]}
    >
      {icon ? <Ionicons name={icon} size={20} color={active ? styles.onTxt : styles.muted} /> : null}
      <Text style={[styles.choiceTxt, active && styles.choiceTxtOn]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(colors: ReturnType<typeof usePreferences>["colors"]) {
  return {
    ...StyleSheet.create({
      root: { flex: 1, backgroundColor: colors.bg },
      scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
      section: {
        fontFamily: fonts.semibold,
        fontSize: 13,
        color: colors.textMuted,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginBottom: spacing.sm,
        marginTop: spacing.md,
      },
      row: { flexDirection: "row", gap: spacing.sm },
      choice: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: spacing.md,
        borderRadius: radii.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        backgroundColor: colors.bgElevated,
      },
      choiceOn: {
        borderColor: colors.accent,
        backgroundColor: colors.accentDim,
      },
      choiceTxt: {
        fontFamily: fonts.semibold,
        fontSize: 15,
        color: colors.textMuted,
      },
      choiceTxtOn: { color: colors.accent },
    }),
    onTxt: colors.accent,
    muted: colors.textMuted,
  };
}
