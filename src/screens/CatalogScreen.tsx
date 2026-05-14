import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CommonActions, useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { apiGet } from "../api/client";
import type { MainTabParamList } from "../navigation/types";
import type { ListingRow } from "../types/api";
import { colors, fonts, radii, spacing } from "../theme";
import { formatKm, formatRub } from "../utils/format";

type Props = BottomTabScreenProps<MainTabParamList, "Garage">;

function StatusChip({ status }: { status: string }) {
  const label =
    status === "moderation"
      ? "Проверка"
      : status === "published"
        ? "Онлайн"
        : status === "archived"
          ? "Отказ"
          : status === "draft"
            ? "Черновик"
            : status;
  const wrapStyle =
    status === "published"
      ? styles.chipOk
      : status === "moderation"
        ? styles.chipWait
        : status === "archived"
          ? styles.chipBad
          : styles.chipNeu;
  const txtStyle =
    status === "published"
      ? styles.chipTxtOk
      : status === "moderation"
        ? styles.chipTxtWait
        : status === "archived"
          ? styles.chipTxtBad
          : styles.chipTxtNeu;
  return (
    <View style={[styles.chip, wrapStyle]}>
      <Text style={[styles.chipTxt, txtStyle]}>{label}</Text>
    </View>
  );
}

export default function CatalogScreen({ navigation }: Props) {
  const [items, setItems] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const tabBarHeight = useBottomTabBarHeight();

  const load = useCallback(async () => {
    const data = await apiGet<ListingRow[]>("/api/me/listings");
    setItems(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          await load();
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(it) => it.id}
      contentContainerStyle={[
        styles.list,
        { paddingBottom: tabBarHeight + spacing.lg },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={Platform.OS === "android" ? [colors.accent] : undefined}
          progressBackgroundColor={colors.bgElevated}
        />
      }
      ListEmptyComponent={
        <Text style={styles.empty}>Пока нет объявлений</Text>
      }
      renderItem={({ item }) => {
        const uri = item.images?.[0];
        return (
          <Pressable
            onPress={() =>
              navigation.getParent()?.dispatch(
                CommonActions.navigate({
                  name: "VehicleDetail",
                  params: { scope: "listing", id: item.id },
                })
              )
            }
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
          >
            {uri ? (
              <Image source={{ uri }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbPh]} />
            )}
            <View style={styles.cardBody}>
              <View style={styles.titleRow}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <StatusChip status={item.status} />
              </View>
              <Text style={styles.meta}>
                {[item.brand, item.model, item.year].join(" · ")}
              </Text>
              <View style={styles.row}>
                <Text style={styles.price}>{formatRub(item.price_rub)}</Text>
                <Text style={styles.km}>{formatKm(item.mileage_km)}</Text>
              </View>
              {item.city ? (
                <Text style={styles.city}>{item.city}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { padding: spacing.lg, gap: spacing.md },
  empty: {
    textAlign: "center",
    marginTop: spacing.xl,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  card: {
    flexDirection: "row",
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 112, height: 112 },
  thumbPh: { backgroundColor: colors.surface },
  cardBody: { flex: 1, padding: spacing.md, justifyContent: "center", minWidth: 0 },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    flexShrink: 0,
  },
  chipTxt: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.3 },
  chipTxtOk: { color: colors.success },
  chipTxtWait: { color: colors.accent },
  chipTxtBad: { color: colors.danger },
  chipTxtNeu: { color: colors.textMuted },
  chipOk: { backgroundColor: "rgba(92,227,138,0.15)" },
  chipWait: { backgroundColor: colors.accentDim },
  chipBad: { backgroundColor: "rgba(255,107,107,0.12)" },
  chipNeu: { backgroundColor: colors.surface },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
    flex: 1,
    minWidth: 0,
  },
  meta: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  price: { fontFamily: fonts.bold, fontSize: 16, color: colors.accent },
  km: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  city: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.gold,
  },
});
