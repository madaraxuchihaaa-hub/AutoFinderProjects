import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { apiGet } from "../api/client";
import type { MainTabParamList } from "../navigation/types";
import type { QueueJobRow } from "../types/api";
import { colors, fonts, radii, spacing } from "../theme";
import { formatRub } from "../utils/format";

type Props = BottomTabScreenProps<MainTabParamList, "Automation">;

const statusLabel: Record<string, string> = {
  pending: "В очереди",
  processing: "В работе",
  published: "Размещено",
  failed: "Ошибка",
  cancelled: "Отменено",
};

export default function QueueScreen(_props: Props) {
  const [rows, setRows] = useState<QueueJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await apiGet<QueueJobRow[]>("/api/queue/jobs");
    setRows(data);
  }, []);

  useEffect(() => {
    let m = true;
    (async () => {
      try {
        await load();
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, [load]);

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
      data={rows}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
        />
      }
      ListHeaderComponent={
        <Text style={styles.intro}>
          Задачи автоматического выкладывания на площадки. После создания объявления
          в гараже сюда попадают записи для Авито, Дром и др.
        </Text>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>Очередь пуста — создайте объявление в гараже.</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.platform}>{item.platform_name}</Text>
            <Text
              style={[
                styles.badge,
                item.status === "failed" && styles.badgeErr,
                item.status === "published" && styles.badgeOk,
              ]}
            >
              {statusLabel[item.status] ?? item.status}
            </Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {item.listing_title}
          </Text>
          <Text style={styles.price}>{formatRub(item.price_rub)}</Text>
          {item.last_error ? (
            <Text style={styles.err}>{item.last_error}</Text>
          ) : null}
        </View>
      )}
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
  list: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  intro: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  empty: {
    marginTop: spacing.xl,
    textAlign: "center",
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  platform: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.accent,
  },
  badge: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  badgeOk: { color: colors.success },
  badgeErr: { color: colors.danger },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
  },
  price: {
    marginTop: 4,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.gold,
  },
  err: {
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.danger,
  },
});
