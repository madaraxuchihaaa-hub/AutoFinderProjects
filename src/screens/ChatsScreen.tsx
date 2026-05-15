import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CommonActions } from "@react-navigation/native";
import { apiGet } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { MainTabParamList } from "../navigation/types";
import type { ConversationRow } from "../types/api";
import { colors, fonts, radii, spacing } from "../theme";

type Props = BottomTabScreenProps<MainTabParamList, "Chats">;

export default function ChatsScreen({ navigation }: Props) {
  const { token } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const [items, setItems] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setItems([]);
      return;
    }
    const data = await apiGet<ConversationRow[]>("/api/conversations");
    setItems(data);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
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

  if (!token) {
    return (
      <View style={[styles.center, { paddingHorizontal: spacing.lg }]}>
        <Text style={styles.guestTitle}>Войдите в аккаунт</Text>
        <Text style={styles.guestHint}>Чаты доступны после входа — как на сайте.</Text>
        <Pressable
          style={styles.guestBtn}
          onPress={() =>
            navigation.getParent()?.dispatch(CommonActions.navigate({ name: "Login" }))
          }
        >
          <Text style={styles.guestBtnTxt}>Войти</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(it) => it.id}
      contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + spacing.lg }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          tintColor={colors.accent}
          colors={Platform.OS === "android" ? [colors.accent] : undefined}
        />
      }
      ListEmptyComponent={
        <Text style={styles.empty}>
          Пока нет переписок. Откройте объявление и нажмите «Написать продавцу».
        </Text>
      }
      renderItem={({ item }) => {
        const title = item.listing_title || `${item.listing_brand} ${item.listing_model}`;
        const peer = item.peer_name || item.peer_email;
        return (
          <Pressable
            onPress={() =>
              navigation.getParent()?.dispatch(
                CommonActions.navigate({
                  name: "ChatDetail",
                  params: {
                    conversationId: item.id,
                    title: peer,
                    listingTitle: title,
                  },
                })
              )
            }
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
          >
            <Text style={styles.cardTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.peer}>{peer}</Text>
            {item.last_message ? (
              <Text style={styles.preview} numberOfLines={2}>
                {item.last_message}
              </Text>
            ) : (
              <Text style={styles.previewMuted}>Нет сообщений</Text>
            )}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  list: { padding: spacing.lg, gap: spacing.md },
  empty: {
    textAlign: "center",
    marginTop: spacing.xl,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  peer: {
    marginTop: 4,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.accent,
  },
  preview: {
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  previewMuted: {
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  guestTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  guestHint: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  guestBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: radii.md,
  },
  guestBtnTxt: { fontFamily: fonts.semibold, fontSize: 16, color: colors.bg },
});
