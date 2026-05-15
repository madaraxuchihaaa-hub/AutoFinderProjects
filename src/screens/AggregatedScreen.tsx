import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CommonActions } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { apiGet } from "../api/client";
import type { MainTabParamList } from "../navigation/types";
import type { AggregatedRow } from "../types/api";
import { readPriceByn } from "../types/api";
import { usePreferences } from "../preferences/PreferencesContext";
import type { ThemeColors } from "../theme/colors";
import { fonts, radii, spacing } from "../theme";
import PriceText from "../components/PriceText";
import { formatKm } from "../utils/format";

type Props = BottomTabScreenProps<MainTabParamList, "Market">;

export default function AggregatedScreen({ navigation }: Props) {
  const { colors } = usePreferences();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [items, setItems] = useState<AggregatedRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const tabBarHeight = useBottomTabBarHeight();

  const load = useCallback(async (q: string) => {
    const qs = q.trim() ? `&q=${encodeURIComponent(q.trim())}` : "";
    const data = await apiGet<AggregatedRow[]>(`/api/aggregated?limit=50${qs}`);
    setItems(data);
  }, []);

  useEffect(() => {
    let m = true;
    (async () => {
      try {
        await load("");
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, [load]);

  useEffect(() => {
    if (loading) return;
    const tmr = setTimeout(() => {
      void load(query);
    }, 320);
    return () => clearTimeout(tmr);
  }, [query, load, loading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(query);
    } finally {
      setRefreshing(false);
    }
  }, [load, query]);

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
      ListHeaderComponent={
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Марка, модель, город…"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          {query.trim() ? "По запросу ничего не найдено" : "Нет объявлений в ленте"}
        </Text>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={Platform.OS === "android" ? [colors.accent] : undefined}
          progressBackgroundColor={colors.bgElevated}
        />
      }
      renderItem={({ item }) => {
        const uri = item.image_urls?.[0];
        return (
          <Pressable
            onPress={() =>
              navigation.getParent()?.dispatch(
                CommonActions.navigate({
                  name: "VehicleDetail",
                  params: { scope: "aggregated", id: item.id },
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
                {[item.brand, item.model, item.year].filter(Boolean).join(" · ")}
              </Text>
              <View style={styles.row}>
                <PriceText priceByn={readPriceByn(item)} size="md" />
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

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: {
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    list: { padding: spacing.lg, gap: spacing.md },
    searchWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.bgElevated,
      borderRadius: radii.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
    },
    searchIcon: { marginRight: spacing.sm },
    searchInput: {
      flex: 1,
      fontFamily: fonts.regular,
      fontSize: 16,
      color: colors.text,
      paddingVertical: Platform.OS === "ios" ? 12 : 10,
    },
    clearBtn: { marginLeft: spacing.sm },
    empty: {
      textAlign: "center",
      fontFamily: fonts.regular,
      fontSize: 14,
      color: colors.textMuted,
      marginTop: spacing.xl,
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
}
