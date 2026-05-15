import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { usePreferences } from "../preferences/PreferencesContext";
import type { ThemeColors } from "../theme/colors";
import { fonts, radii, spacing } from "../theme";

type Props = {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function FilterSelect({ label, value, options, onChange, placeholder }: Props) {
  const { colors } = usePreferences();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const display =
    options.find((o) => o.value === value)?.label || value || placeholder || "—";

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, pressed && { opacity: 0.9 }]}
      >
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {display}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{label}</Text>
          <ScrollView style={styles.list}>
            <Pressable
              onPress={() => {
                onChange("");
                setOpen(false);
              }}
              style={styles.option}
            >
              <Text style={styles.optionTxt}>Любой</Text>
            </Pressable>
            {options.map((o) => (
              <Pressable
                key={o.value}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={[styles.option, value === o.value && styles.optionOn]}
              >
                <Text style={[styles.optionTxt, value === o.value && styles.optionTxtOn]}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { flex: 1, minWidth: 0 },
    label: {
      fontFamily: fonts.medium,
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 4,
    },
    field: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: 10,
      minHeight: 42,
    },
    value: {
      flex: 1,
      fontFamily: fonts.regular,
      fontSize: 14,
      color: colors.text,
    },
    placeholder: { color: colors.textMuted },
    chevron: { fontSize: 12, color: colors.textMuted, marginLeft: 4 },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
    sheet: {
      position: "absolute",
      left: spacing.lg,
      right: spacing.lg,
      bottom: spacing.xl * 2,
      maxHeight: "55%",
      backgroundColor: colors.bgElevated,
      borderRadius: radii.lg,
      padding: spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    sheetTitle: {
      fontFamily: fonts.bold,
      fontSize: 17,
      color: colors.text,
      marginBottom: spacing.md,
    },
    list: { maxHeight: 320 },
    option: {
      paddingVertical: 12,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.sm,
    },
    optionOn: { backgroundColor: colors.accentDim },
    optionTxt: { fontFamily: fonts.regular, fontSize: 16, color: colors.text },
    optionTxtOn: { fontFamily: fonts.semibold, color: colors.accent },
  });
}
