import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { apiGet } from "../api/client";
import { colors, radii, spacing } from "../theme";

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

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  hint: { color: colors.muted, fontSize: 13 },
  label: { color: colors.muted, fontSize: 13, marginBottom: 4 },
  trimRow: { marginBottom: spacing.sm },
  block: { marginBottom: spacing.xs },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  toggleLabel: { color: colors.text, fontSize: 15, fontWeight: "600", flex: 1 },
  count: { color: colors.accent, fontWeight: "700", fontSize: 14 },
  panel: {
    marginTop: 6,
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipOn: {
    borderColor: colors.accent,
    backgroundColor: "rgba(61, 139, 253, 0.18)",
  },
  chipTxt: { color: colors.muted, fontSize: 13 },
  chipTxtOn: { color: colors.text, fontWeight: "600" },
});
