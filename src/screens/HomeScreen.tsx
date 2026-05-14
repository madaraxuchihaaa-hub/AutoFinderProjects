import { LinearGradient } from "expo-linear-gradient";
import { CommonActions } from "@react-navigation/native";
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

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingBottom: spacing.xl + insets.bottom,
      }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={["#0F1A28", "#070A0E", "#070A0E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}
      >
        <Text style={styles.badge}>React Native · Node · PostgreSQL</Text>
        <Text style={styles.title}>AutoFinder</Text>
        <Text style={styles.subtitle}>
          Агрегация объявлений и очередь автоматического размещения на
          площадках из одного окна.
        </Text>
        {err ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>API недоступен</Text>
            <Text style={styles.warnText}>{err}</Text>
            <Text style={styles.warnHint}>
              {isStandaloneAppWithoutApiEnv()
                ? "В корне проекта создайте файл .env с строкой EXPO_PUBLIC_API_URL=https://ваш-проект.up.railway.app (без слэша в конце), затем заново соберите APK (npm run android:apk:debug)."
                : hasRemoteApiUrl()
                  ? "Проверьте, что API на Railway запущен и открывается в браузере по этому же адресу (/health)."
                  : "Для Expo на телефоне: в .env укажите EXPO_PUBLIC_API_URL на Railway или запустите API на ПК (npm run server) в той же Wi‑Fi сети. Для эмулятора достаточно локального сервера."}
            </Text>
          </View>
        ) : null}
        <View style={styles.statsRow}>
          <StatBox
            label="Витрина агрегатора"
            value={stats?.aggregated ?? "—"}
          />
          <StatBox
            label="Опубликовано"
            value={stats?.publishedListings ?? "—"}
          />
          <StatBox label="В очереди" value={stats?.queuePending ?? "—"} />
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Быстрые действия</Text>
        <View style={styles.tiles}>
          <Tile
            title="Рынок"
            caption="Вкладка «Рынок»"
            onPress={() => navigation.navigate("Market")}
          />
          <Tile
            title="Гараж"
            caption="Ваши объявления"
            onPress={() => navigation.navigate("Garage")}
          />
          <Tile
            title="Новое объявление"
            caption="Создать и в очередь"
            onPress={() => goModal(navigation, "CreateListing")}
          />
          <Tile
            title="Площадки"
            caption="Куда публикуем"
            onPress={() => goModal(navigation, "Platforms")}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Сейчас в агрегаторе</Text>
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
                onPress={() =>
                  goVehicle(navigation, "aggregated", item.id)
                }
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

function Tile({
  title,
  caption,
  onPress,
}: {
  title: string;
  caption: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.9 }]}>
      <LinearGradient
        colors={[colors.surface, colors.bgElevated]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tileInner}
      >
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileCap}>{caption}</Text>
      </LinearGradient>
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
  badge: {
    alignSelf: "flex-start",
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.accent,
    backgroundColor: colors.accentDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 36,
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
    maxWidth: 360,
  },
  warnBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,107,107,0.08)",
  },
  warnTitle: {
    fontFamily: fonts.semibold,
    color: colors.danger,
    marginBottom: 4,
  },
  warnText: { fontFamily: fonts.regular, color: colors.textMuted, fontSize: 13 },
  warnHint: {
    marginTop: spacing.sm,
    fontFamily: fonts.medium,
    color: colors.text,
    fontSize: 12,
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 20,
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
    marginTop: spacing.xl,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.md,
  },
  tiles: { gap: spacing.sm },
  tile: {
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileInner: { padding: spacing.lg },
  tileTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: colors.text,
  },
  tileCap: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
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
