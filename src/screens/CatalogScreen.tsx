import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CommonActions, useFocusEffect } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { apiGet } from "../api/client";
import type { MainTabParamList } from "../navigation/types";
import type { ListingRow } from "../types/api";
import { colors, fonts, radii, spacing } from "../theme";
import { formatKm, formatRub } from "../utils/format";

type Props = BottomTabScreenProps<MainTabParamList, "Garage">;

export default function CatalogScreen({ navigation }: Props) {
  const [items, setItems] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await apiGet<ListingRow[]>("/api/listings?limit=50");
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
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
        />
      }
      ListEmptyComponent={
        <Text style={styles.empty}>Нет опубликованных объявлений</Text>
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
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
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
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
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
  cardBody: { flex: 1, padding: spacing.md, justifyContent: "center" },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
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
