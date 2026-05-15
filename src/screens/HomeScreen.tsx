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

function goModal(navigation: Props["navigation"], name: "Platforms" | "CreateListing") {
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
        <View style={styles.statsRow}>
          <StatBox label="Витрина" value={stats?.aggregated ?? "—"} />
          <StatBox label="Онлайн" value={stats?.publishedListings ?? "—"} />
          <StatBox label="В очереди" value={stats?.queuePending ?? "—"} />
        </View>
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
          <ActionRow
            icon="share-social-outline"
            title="Площадки"
            onPress={() => goModal(navigation, "Platforms")}
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
            const uri = item.image_urls?.[0];
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

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  statBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 19,
    color: colors.accent,
  },
  statLabel: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
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
