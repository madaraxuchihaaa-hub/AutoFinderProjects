import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import { usePreferences } from "../preferences/PreferencesContext";
import { fonts, radii, spacing } from "../theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onNavigateGarage: () => void;
  onNavigateProfile: () => void;
  onNavigateStaff: () => void;
  onNavigateCreate: () => void;
  onNavigateSettings: () => void;
  onNavigateFavorites: () => void;
  onNavigateCompare: () => void;
  compareCount?: number;
};

export default function AppMenuSheet({
  visible,
  onClose,
  onNavigateGarage,
  onNavigateProfile,
  onNavigateStaff,
  onNavigateCreate,
  onNavigateSettings,
  onNavigateFavorites,
  onNavigateCompare,
  compareCount = 0,
}: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors, t } = usePreferences();
  const staff = user?.role === "admin" || user?.role === "moderator";
  const styles = makeStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>{t("tabMenu")}</Text>
        <MenuRow icon="car-sport" label={t("menuGarage")} onPress={onNavigateGarage} styles={styles} />
        <MenuRow icon="heart-outline" label={t("menuFavorites")} onPress={onNavigateFavorites} styles={styles} />
        <MenuRow
          icon="git-compare-outline"
          label={compareCount > 0 ? `${t("menuCompare")} (${compareCount})` : t("menuCompare")}
          onPress={onNavigateCompare}
          styles={styles}
        />
        <MenuRow icon="add-circle-outline" label={t("menuNewListing")} onPress={onNavigateCreate} styles={styles} />
        {staff ? (
          <MenuRow
            icon={user?.role === "admin" ? "speedometer-outline" : "shield-checkmark-outline"}
            label={user?.role === "admin" ? t("menuAdmin") : t("menuModeration")}
            onPress={onNavigateStaff}
            styles={styles}
          />
        ) : null}
        <MenuRow icon="person-circle-outline" label={t("menuProfile")} onPress={onNavigateProfile} styles={styles} />
        <View style={styles.divider} />
        <MenuRow icon="settings-outline" label={t("menuSettings")} onPress={onNavigateSettings} styles={styles} />
      </View>
    </Modal>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.88 }]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={styles.accentColor} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={styles.mutedColor} />
    </Pressable>
  );
}

function makeStyles(colors: ReturnType<typeof usePreferences>["colors"]) {
  return {
    ...StyleSheet.create({
      backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
      sheet: {
        backgroundColor: colors.bgElevated,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
      },
      handle: {
        alignSelf: "center",
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
        marginBottom: spacing.md,
      },
      title: {
        fontFamily: fonts.bold,
        fontSize: 20,
        color: colors.text,
        marginBottom: spacing.md,
      },
      row: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing.md,
        gap: spacing.md,
      },
      iconWrap: {
        width: 44,
        height: 44,
        borderRadius: radii.md,
        backgroundColor: colors.accentDim,
        alignItems: "center",
        justifyContent: "center",
      },
      rowLabel: {
        flex: 1,
        fontFamily: fonts.semibold,
        fontSize: 16,
        color: colors.text,
      },
      divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginVertical: spacing.sm,
      },
    }),
    accentColor: colors.accent,
    mutedColor: colors.textMuted,
  };
}
