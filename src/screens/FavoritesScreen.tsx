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
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { apiGet, resolveMediaUrl } from "../api/client";
import PriceText from "../components/PriceText";
import type { RootStackParamList } from "../navigation/types";
import type { ListingRow } from "../types/api";
import { readPriceByn } from "../types/api";
import { colors, fonts, radii, spacing } from "../theme";
import { formatKm } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "Favorites">;

export default function FavoritesScreen({ navigation }: Props) {
  const [items, setItems] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await apiGet<ListingRow[]>("/api/me/favorites");
    setItems(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        try {
          await load();
        } catch {
          if (alive) setItems([]);
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [load])
  );

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
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
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
      ListEmptyComponent={
        <Text style={styles.empty}>Список избранного пуст. Добавляйте объявления из каталога.</Text>
      }
      renderItem={({ item }) => {
        const img = Array.isArray(item.images)
          ? resolveMediaUrl(item.images[0])
          : null;
        return (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
            onPress={() =>
              navigation.dispatch(
                CommonActions.navigate({
                  name: "VehicleDetail",
                  params: { scope: "listing", id: item.id },
                })
              )
            }
          >
            {img ? (
              <Image source={{ uri: img }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.ph]}>
                <Text style={styles.phTxt}>Нет фото</Text>
              </View>
            )}
            <View style={styles.body}>
              <Text style={styles.title} numberOfLines={2}>
                {item.brand} {item.model}
              </Text>
              <PriceText priceByn={readPriceByn(item)} />
              <Text style={styles.meta}>
                {item.year} г. · {formatKm(item.mileage_km)} · {item.city ?? "—"}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  list: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  empty: {
    textAlign: "center",
    fontFamily: fonts.regular,
    color: colors.textMuted,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  card: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  thumb: { width: 120, minHeight: 90, backgroundColor: colors.bgElevated },
  ph: { alignItems: "center", justifyContent: "center" },
  phTxt: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  body: { flex: 1, padding: spacing.md, gap: 4 },
  title: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 4 },
});
