import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiGet } from "../api/client";
import { usePreferences } from "../preferences/PreferencesContext";
import type { ThemeColors } from "../theme/colors";
import { fonts, radii, spacing } from "../theme";
import {
  isValidBrandModel,
  mergeCatalogNames,
  searchBrandsLocal,
  searchModelsLocal,
} from "../utils/vehicleCatalog";

const BRAND_LIMIT = 50;
const MODEL_LIMIT = 50;

type BrandRow = { id: number; name: string };
type ModelRow = { id: number; name: string; brand_name: string };

type Props = {
  kind: "brand" | "model";
  label: string;
  value: string;
  brand?: string;
  onChange: (value: string) => void;
  onSelect?: (value: string) => void;
  placeholder?: string;
};

export default function VehicleAutocomplete({
  kind,
  label,
  value,
  brand,
  onChange,
  onSelect,
  placeholder,
}: Props) {
  const { colors, t } = usePreferences();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<string[]>([]);
  const fetchItems = useCallback(
    async (q: string) => {
      if (kind === "model" && !brand?.trim()) {
        setItems([]);
        return;
      }
      setLoading(true);
      try {
        if (kind === "brand") {
          const local = searchBrandsLocal(q, BRAND_LIMIT);
          let api: string[] = [];
          try {
            const rows = await apiGet<BrandRow[]>(
              `/api/vehicles/brands?q=${encodeURIComponent(q)}&limit=${BRAND_LIMIT}`
            );
            api = rows.map((r) => r.name);
          } catch {
            api = [];
          }
          setItems(mergeCatalogNames(local, api, BRAND_LIMIT));
        } else {
          const local = searchModelsLocal(brand!, q, MODEL_LIMIT);
          let api: string[] = [];
          try {
            const rows = await apiGet<ModelRow[]>(
              `/api/vehicles/models?brand=${encodeURIComponent(brand!)}&q=${encodeURIComponent(q)}&limit=${MODEL_LIMIT}`
            );
            api = rows.map((r) => r.name);
          } catch {
            api = [];
          }
          setItems(mergeCatalogNames(local, api, MODEL_LIMIT));
        }
      } finally {
        setLoading(false);
      }
    },
    [kind, brand]
  );

  useEffect(() => {
    if (!open) return;
    const tmr = setTimeout(() => void fetchItems(value), 180);
    return () => clearTimeout(tmr);
  }, [open, value, fetchItems]);

  function pick(name: string) {
    onChange(name);
    onSelect?.(name);
    setOpen(false);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(txt) => {
          onChange(txt);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          void fetchItems(value);
        }}
        placeholder={placeholder ?? t("pickFromList")}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        editable={kind === "brand" || Boolean(brand?.trim())}
      />
      {kind === "model" && !brand?.trim() ? (
        <Text style={styles.hint}>{t("pickFromList")}</Text>
      ) : null}
      {open && (kind === "brand" || brand?.trim()) ? (
        <View style={styles.dropdown}>
          {loading ? (
            <ActivityIndicator color={colors.accent} style={styles.loader} />
          ) : items.length === 0 ? (
            <Text style={styles.empty}>{t("noMatches")}</Text>
          ) : (
            <FlatList
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              data={items}
              keyExtractor={(it) => it}
              style={styles.list}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => pick(item)}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.rowTxt}>{item}</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

/** Проверка марки/модели: API или локальный JSON. */
export async function validateBrandModelChoice(
  brand: string,
  model: string
): Promise<boolean> {
  const b = brand.trim();
  const m = model.trim();
  if (!b || !m) return false;
  try {
    const brands = await apiGet<{ name: string }[]>(
      `/api/vehicles/brands?q=${encodeURIComponent(b)}&limit=10`
    );
    if (brands.some((x) => x.name === b)) {
      const models = await apiGet<{ name: string }[]>(
        `/api/vehicles/models?brand=${encodeURIComponent(b)}&q=${encodeURIComponent(m)}&limit=15`
      );
      if (models.some((x) => x.name === m)) return true;
    }
  } catch {
    /* fallback */
  }
  return isValidBrandModel(b, m);
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { marginBottom: spacing.md, zIndex: 1 },
    label: {
      fontFamily: fonts.medium,
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontFamily: fonts.regular,
      fontSize: 16,
      color: colors.text,
    },
    hint: {
      marginTop: 4,
      fontFamily: fonts.regular,
      fontSize: 11,
      color: colors.textMuted,
    },
    dropdown: {
      marginTop: 4,
      maxHeight: 200,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },
    list: { maxHeight: 200 },
    row: {
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowTxt: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
    empty: {
      padding: spacing.md,
      fontFamily: fonts.regular,
      fontSize: 13,
      color: colors.textMuted,
      textAlign: "center",
    },
    loader: { padding: spacing.md },
  });
}
