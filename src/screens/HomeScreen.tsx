import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { CommonActions } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useEffect, useState } from "react";
import {
  apiGet,
  hasRemoteApiUrl,
  isStandaloneAppWithoutApiEnv,
  resolveMediaUrl,
} from "../api/client";
import type { AggregatedRow, StatsResponse } from "../types/api";
import { colors, fonts, radii, spacing } from "../theme";
import type { MainTabParamList } from "../navigation/types";

type Props = BottomTabScreenProps<MainTabParamList, "Home">;

function goVehicle(
  navigation: Props["navigation"],
  scope: "aggregated" | "listing",
  id: string
) {
  navigation
    .getParent()
    ?.dispatch(
      CommonActions.navigate({
        name: "VehicleDetail",
        params: { scope, id },
      })
    );
}

function goModal(navigation: Props["navigation"], name: "CreateListing") {
  navigation.getParent()?.dispatch(CommonActions.navigate({ name }));
}

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const scrollBottom = tabBarHeight + spacing.md;
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [featured, setFeatured] = useState<AggregatedRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, a] = await Promise.all([
          apiGet<StatsResponse>("/api/stats"),
          apiGet<AggregatedRow[]>("/api/aggregated?limit=8"),
        ]);
        if (!alive) return;
        setStats(s);
        setFeatured(a);
        setErr(null);
      } catch (e) {
        if (!alive) return;
        setErr(e instanceof Error ? e.message : "Нет связи с API");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const errHint = isStandaloneAppWithoutApiEnv()
    ? "В .env задайте EXPO_PUBLIC_API_URL и пересоберите APK."
    : hasRemoteApiUrl()
      ? "Проверьте, что API отвечает по адресу из .env (/health)."
      : "В .env укажите EXPO_PUBLIC_API_URL (Railway или IP ПК в Wi‑Fi).";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: scrollBottom }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={["#0F1A28", "#070A0E", "#070A0E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}
      >
        <Text style={styles.title}>AutoFinder</Text>
        <Text style={styles.subtitle}>Подбор и публикация объявлений</Text>
        {err ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>Нет связи с API</Text>
            <Text style={styles.warnText} numberOfLines={2}>
              {err}
            </Text>
            <Text style={styles.warnHint}>{errHint}</Text>
          </View>
        ) : null}
        <StatsOverview
          stats={stats}
          onPressListings={() => navigation.navigate("Listings")}
          onPressGarage={() => navigation.navigate("Garage")}
        />
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Действия</Text>
        <View style={styles.actions}>
          <ActionRow
            icon="newspaper-outline"
            title="Объявления"
            onPress={() => navigation.navigate("Listings")}
          />
          <ActionRow
            icon="car-sport"
            title="Гараж"
            onPress={() => navigation.navigate("Garage")}
          />
          <ActionRow
            icon="add-circle-outline"
            title="Новое объявление"
            onPress={() => goModal(navigation, "CreateListing")}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Свежие</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hScroll}
        >
          {featured.map((item) => {
            const uri = resolveMediaUrl(item.image_urls?.[0]);
            return (
              <Pressable
                key={item.id}
                onPress={() => goVehicle(navigation, "aggregated", item.id)}
                style={styles.miniCard}
              >
                {uri ? (
                  <ImageBackground
                    source={{ uri }}
                    style={styles.miniImg}
                    imageStyle={{ borderRadius: radii.md }}
                  >
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.85)"]}
                      style={styles.miniGrad}
                    >
                      <Text style={styles.miniTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                    </LinearGradient>
                  </ImageBackground>
                ) : (
                  <View style={[styles.miniImg, styles.miniFallback]}>
                    <Text style={styles.miniTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

function StatsOverview({
  stats,
  onPressListings,
  onPressGarage,
}: {
  stats: StatsResponse | null;
  onPressListings: () => void;
  onPressGarage: () => void;
}) {
  const items = [
    {
      key: "listings",
      icon: "newspaper-outline" as const,
      value: stats?.publishedListings ?? "—",
      label: "Опубликовано",
      hint: "активные объявления",
      onPress: onPressListings,
    },
    {
      key: "queue",
      icon: "time-outline" as const,
      value: stats?.queuePending ?? "—",
      label: "На проверке",
      hint: "ожидают модерации",
      onPress: onPressGarage,
    },
    {
      key: "feed",
      icon: "layers-outline" as const,
      value: stats?.aggregated ?? "—",
      label: "В ленте",
      hint: "всего в каталоге",
      onPress: onPressListings,
    },
  ];

  return (
    <View style={styles.statsPanel}>
      <Text style={styles.statsPanelTitle}>Сводка</Text>
      <View style={styles.statsGrid}>
        {items.map((item, index) => (
          <Pressable
            key={item.key}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.statCard,
              index < items.length - 1 && styles.statCardBorder,
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={styles.statIconWrap}>
              <Ionicons name={item.icon} size={20} color={colors.accent} />
            </View>
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
            <Text style={styles.statHint}>{item.hint}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ActionRow({
  icon,
  title,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.88 }]}
    >
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon} size={22} color={colors.accent} />
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 34,
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
  warnBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "rgba(255,107,107,0.08)",
  },
  warnTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.danger,
    marginBottom: 4,
  },
  warnText: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 12 },
  warnHint: {
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  statsPanel: {
    marginTop: spacing.lg,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  statsPanelTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  statsGrid: {
    flexDirection: "row",
  },
  statCard: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
  },
  statCardBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    marginTop: 2,
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.accent,
    textAlign: "center",
  },
  statHint: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: "center",
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
    letterSpacing: 0.2,
  },
  actions: { gap: spacing.sm },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  actionTitle: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
  },
  hScroll: { gap: spacing.sm, paddingRight: spacing.lg },
  miniCard: {
    width: 200,
    height: 120,
    borderRadius: radii.md,
    overflow: "hidden",
  },
  miniImg: { flex: 1, justifyContent: "flex-end" },
  miniGrad: {
    padding: spacing.sm,
    borderBottomLeftRadius: radii.md,
    borderBottomRightRadius: radii.md,
  },
  miniFallback: {
    backgroundColor: colors.surface,
    justifyContent: "flex-end",
    padding: spacing.sm,
  },
  miniTitle: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.text,
  },
});
