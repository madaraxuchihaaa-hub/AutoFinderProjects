import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { apiGet } from "../api/client";
import { usePreferences } from "../preferences/PreferencesContext";
import type { ThemeColors } from "../theme/colors";
import { fonts, radii, spacing } from "../theme";

export type EquipmentCatalog = {
  trim_levels: string[];
  categories: {
    id: string;
    label: string;
    multiple: boolean;
    options: string[];
  }[];
};

export type EquipmentMap = Record<string, string[]>;

type Props = {
  trimLevel: string;
  onTrimChange: (v: string) => void;
  equipment: EquipmentMap;
  onEquipmentChange: (eq: EquipmentMap) => void;
};

export default function EquipmentPickers({
  trimLevel,
  onTrimChange,
  equipment,
  onEquipmentChange,
}: Props) {
  const { colors } = usePreferences();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [catalog, setCatalog] = useState<EquipmentCatalog | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let m = true;
    void apiGet<EquipmentCatalog>("/api/catalog/equipment-options", { auth: false })
      .then((c) => {
        if (m) setCatalog(c);
      })
      .catch(() => {
        if (m) setCatalog(null);
      });
    return () => {
      m = false;
    };
  }, []);

  if (!catalog) {
    return <Text style={styles.hint}>Загрузка списка опций…</Text>;
  }

  function toggle(catId: string, opt: string, multiple: boolean) {
    const cur = equipment[catId] ?? [];
    let next: string[];
    if (cur.includes(opt)) {
      next = cur.filter((x) => x !== opt);
    } else if (multiple) {
      next = [...cur, opt];
    } else {
      next = [opt];
    }
    const copy = { ...equipment };
    if (next.length) copy[catId] = next;
    else delete copy[catId];
    onEquipmentChange(copy);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Комплектация</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trimRow}>
        <Pressable
          onPress={() => onTrimChange("")}
          style={[styles.chip, !trimLevel && styles.chipOn]}
        >
          <Text style={[styles.chipTxt, !trimLevel && styles.chipTxtOn]}>—</Text>
        </Pressable>
        {catalog.trim_levels.map((t) => (
          <Pressable
            key={t}
            onPress={() => onTrimChange(t)}
            style={[styles.chip, trimLevel === t && styles.chipOn]}
          >
            <Text style={[styles.chipTxt, trimLevel === t && styles.chipTxtOn]}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {catalog.categories.map((cat) => {
        const selected = equipment[cat.id] ?? [];
        const open = openId === cat.id;
        return (
          <View key={cat.id} style={styles.block}>
            <Pressable
              onPress={() => setOpenId(open ? null : cat.id)}
              style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.toggleLabel}>{cat.label}</Text>
              {selected.length > 0 ? (
                <Text style={styles.count}>{selected.length}</Text>
              ) : null}
            </Pressable>
            {open ? (
              <View style={styles.panel}>
                <View style={styles.chips}>
                  {cat.options.map((opt) => {
                    const on = selected.includes(opt);
                    return (
                      <Pressable
                        key={opt}
                        onPress={() => toggle(cat.id, opt, cat.multiple)}
                        style={[styles.chip, on && styles.chipOn]}
                      >
                        <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{opt}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { gap: spacing.sm },
    hint: {
      fontFamily: fonts.regular,
      fontSize: 13,
      color: colors.textMuted,
    },
    label: {
      fontFamily: fonts.medium,
      fontSize: 13,
      color: colors.textMuted,
      marginBottom: 4,
    },
    trimRow: { marginBottom: spacing.sm },
    block: { marginBottom: spacing.xs },
    toggle: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    toggleLabel: {
      fontFamily: fonts.semibold,
      fontSize: 15,
      color: colors.text,
      flex: 1,
    },
    count: {
      fontFamily: fonts.bold,
      fontSize: 14,
      color: colors.accent,
    },
    panel: {
      marginTop: 6,
      padding: 10,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipOn: {
      borderColor: colors.accent,
      backgroundColor: colors.accentDim,
    },
    chipTxt: {
      fontFamily: fonts.regular,
      fontSize: 13,
      color: colors.text,
    },
    chipTxtOn: {
      fontFamily: fonts.semibold,
      color: colors.text,
    },
  });
}
