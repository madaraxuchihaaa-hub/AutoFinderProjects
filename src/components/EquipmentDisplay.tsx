import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../theme";

export type EquipmentSection = {
  id: string;
  label: string;
  values: string[];
};

type Props = {
  sections: EquipmentSection[];
};

export default function EquipmentDisplay({ sections }: Props) {
  const [open, setOpen] = useState(true);
  if (!sections.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Комплектация</Text>
      {open ? (
        <View style={styles.grid}>
          {sections.map((sec) => (
            <View key={sec.id} style={styles.section}>
              <Text style={styles.sectionTitle}>{sec.label}</Text>
              <View style={styles.chips}>
                {sec.values.map((v) => (
                  <View key={v} style={styles.chip}>
                    <Text style={styles.chipTxt}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}
      <Pressable onPress={() => setOpen((v) => !v)}>
        <Text style={styles.toggle}>{open ? "Скрыть опции" : "Показать опции"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: "700", marginBottom: spacing.sm },
  grid: { gap: spacing.md },
  section: { gap: 6 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#2a323f",
  },
  chipTxt: { color: "#f0f5fb", fontSize: 13 },
  toggle: { marginTop: spacing.sm, color: colors.accent, fontSize: 14, fontWeight: "600" },
});
