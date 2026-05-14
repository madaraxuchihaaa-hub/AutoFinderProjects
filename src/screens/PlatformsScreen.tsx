import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiGet } from "../api/client";
import type { RootStackParamList } from "../navigation/types";
import type { PlatformRow } from "../types/api";
import { colors, fonts, radii, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Platforms">;

export default function PlatformsScreen(_props: Props) {
  const [rows, setRows] = useState<PlatformRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let m = true;
    (async () => {
      try {
        const data = await apiGet<PlatformRow[]>("/api/platforms");
        if (m) setRows(data);
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.intro}>
        Очередь публикаций связывает ваши карточки с этими площадками. Интеграции
        подключаются на сервере без правок клиента.
      </Text>
      {rows.map((p) => (
        <View key={p.id} style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.code}>{p.code}</Text>
          </View>
          {p.base_url ? (
            <Text
              style={styles.link}
              onPress={() => Linking.openURL(p.base_url!)}
            >
              {p.base_url}
            </Text>
          ) : null}
        </View>
      ))}
    </ScrollView>
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
  intro: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    marginBottom: spacing.sm,
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
  },
  name: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
  code: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.accent,
    textTransform: "uppercase",
  },
  link: {
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.gold,
  },
});
