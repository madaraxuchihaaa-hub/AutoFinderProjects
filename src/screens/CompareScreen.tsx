import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { apiGet } from "../api/client";
import PriceText from "../components/PriceText";
import { useSavedListings } from "../hooks/useSavedListings";
import type { RootStackParamList } from "../navigation/types";
import type { ListingRow } from "../types/api";
import { readPriceByn } from "../types/api";
import { colors, fonts, radii, spacing } from "../theme";
import { formatKm } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "Compare">;

const SPECS: { key: string; fn: (i: ListingRow) => string }[] = [
  { key: "Год", fn: (i) => String(i.year ?? "—") },
  { key: "Пробег", fn: (i) => formatKm(i.mileage_km) },
  { key: "Топливо", fn: (i) => i.fuel_type ?? "—" },
  { key: "Коробка", fn: (i) => i.transmission ?? "—" },
  { key: "Кузов", fn: (i) => i.body_type ?? "—" },
  { key: "Город", fn: (i) => i.city ?? "—" },
];

export default function CompareScreen({ navigation }: Props) {
  const { compareMax, toggleCompare, refresh: refreshIds } = useSavedListings();
  const [items, setItems] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await apiGet<ListingRow[]>("/api/me/compare");
    setItems(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        try {
          await load();
          await refreshIds();
        } catch {
          if (alive) setItems([]);
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [load, refreshIds])
  );

  async function remove(id: string) {
    await toggleCompare(id);
    await load();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.body}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
          tintColor={colors.accent}
        />
      }
    >
      <Text style={styles.hint}>
        До {compareMax} объявлений. Данные синхронизируются с веб-сайтом.
      </Text>
      {items.length === 0 ? (
        <Text style={styles.empty}>Добавьте автомобили из каталога или карточки объявления.</Text>
      ) : (
        <>
          {items.map((item) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {item.brand} {item.model}
              </Text>
              <PriceText priceByn={readPriceByn(item)} />
              <View style={styles.row}>
                <Pressable
                  onPress={() =>
                    navigation.dispatch(
                      CommonActions.navigate({
                        name: "VehicleDetail",
                        params: { scope: "listing", id: item.id },
                      })
                    )
                  }
                  style={styles.btnGhost}
                >
                  <Text style={styles.btnGhostTxt}>Открыть</Text>
                </Pressable>
                <Pressable onPress={() => void remove(item.id)} style={styles.btnDanger}>
                  <Text style={styles.btnDangerTxt}>Убрать</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <View style={styles.table}>
            {SPECS.map(({ key, fn }) => (
              <View key={key} style={styles.tableRow}>
                <Text style={styles.tableKey}>{key}</Text>
                {items.map((item) => (
                  <Text key={item.id} style={styles.tableVal}>
                    {fn(item)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  empty: { fontFamily: fonts.regular, color: colors.textMuted, textAlign: "center", marginTop: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginBottom: spacing.xs },
  row: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  btnGhost: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
  },
  btnGhostTxt: { fontFamily: fonts.semibold, color: colors.accent },
  btnDanger: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger,
  },
  btnDangerTxt: { fontFamily: fonts.semibold, color: colors.danger },
  table: { marginTop: spacing.lg, gap: spacing.sm },
  tableRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
  tableKey: { fontFamily: fonts.semibold, color: colors.textMuted, marginBottom: 4 },
  tableVal: { fontFamily: fonts.regular, color: colors.text, marginBottom: 2 },
});
