import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useAuth } from "../auth/AuthContext";
import { apiGet, apiPatch, apiPost } from "../api/client";
import type { MainTabParamList } from "../navigation/types";
import type { AdminUserRow, PendingListingRow, UserRole } from "../types/api";
import { colors, fonts, radii, spacing } from "../theme";
import { formatKm, formatRub } from "../utils/format";

type Props = BottomTabScreenProps<MainTabParamList, "Staff">;
type Section = "queue" | "users";

function roleRu(role: UserRole): string {
  if (role === "admin") return "Админ";
  if (role === "moderator") return "Модератор";
  return "Пользователь";
}

export default function StaffPanelScreen(_props: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const tabBarHeight = useBottomTabBarHeight();
  const [section, setSection] = useState<Section>("queue");
  const [pending, setPending] = useState<PendingListingRow[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadQueue = useCallback(async () => {
    const data = await apiGet<PendingListingRow[]>("/api/staff/pending-listings");
    setPending(data);
  }, []);

  const loadUsers = useCallback(async () => {
    const data = await apiGet<AdminUserRow[]>("/api/admin/users");
    setUsers(data);
  }, []);

  const loadAll = useCallback(async () => {
    await loadQueue();
    if (isAdmin) await loadUsers();
  }, [isAdmin, loadQueue, loadUsers]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        setLoading(true);
        try {
          await loadAll();
        } finally {
          if (alive) setLoading(false);
        }
      })();
      return () => {
        alive = false;
      };
    }, [loadAll])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAll();
    } finally {
      setRefreshing(false);
    }
  }, [loadAll]);

  async function approve(id: string) {
    setBusyId(id);
    try {
      await apiPost<{ ok: boolean }>(`/api/staff/pending-listings/${id}/approve`, {});
      await loadQueue();
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось одобрить");
    } finally {
      setBusyId(null);
    }
  }

  async function submitReject() {
    if (!rejectModal) return;
    const id = rejectModal.id;
    setBusyId(id);
    try {
      await apiPost(`/api/staff/pending-listings/${id}/reject`, {
        reason: rejectReason.trim() || undefined,
      });
      setRejectModal(null);
      setRejectReason("");
      await loadQueue();
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось отклонить");
    } finally {
      setBusyId(null);
    }
  }

  async function setUserRole(targetId: string, role: "user" | "moderator") {
    try {
      await apiPatch<AdminUserRow>(`/api/admin/users/${targetId}`, { role });
      await loadUsers();
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось сохранить роль");
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#0E1824", colors.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.heroTitle}>
          {isAdmin ? "Админ-панель" : "Модерация"}
        </Text>
        <Text style={styles.heroSub}>
          {isAdmin
            ? "Заявки на публикацию и учётные записи"
            : "Проверка объявлений перед выходом в эфир"}
        </Text>
        {isAdmin ? (
          <View style={styles.segments}>
            <Pressable
              onPress={() => setSection("queue")}
              style={[styles.seg, section === "queue" && styles.segOn]}
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color={section === "queue" ? colors.bg : colors.textMuted}
              />
              <Text style={[styles.segTxt, section === "queue" && styles.segTxtOn]}>
                Заявки
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSection("users")}
              style={[styles.seg, section === "users" && styles.segOn]}
            >
              <Ionicons
                name="people-outline"
                size={18}
                color={section === "users" ? colors.bg : colors.textMuted}
              />
              <Text style={[styles.segTxt, section === "users" && styles.segTxtOn]}>
                Пользователи
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.modBadge}>
            <Ionicons name="shield-checkmark" size={16} color={colors.accent} />
            <Text style={styles.modBadgeTxt}>Доступ модератора</Text>
          </View>
        )}
      </LinearGradient>

      {(!isAdmin || section === "queue") && (
        <FlatList
          data={pending}
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
            <Text style={styles.empty}>Нет заявок на модерацию</Text>
          }
          renderItem={({ item }) => {
            const uri = item.images?.[0];
            const busy = busyId === item.id;
            return (
              <View style={styles.card}>
                <View style={styles.cardAccent} />
                <View style={styles.cardRow}>
                  {uri ? (
                    <Image source={{ uri }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPh]}>
                      <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.cardBody}>
                    <Text style={styles.owner}>{item.owner_email}</Text>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.meta}>
                      {[item.brand, item.model, item.year].join(" · ")}
                    </Text>
                    <Text style={styles.price}>{formatRub(item.price_rub)}</Text>
                    <Text style={styles.km}>{formatKm(item.mileage_km)}</Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => void approve(item.id)}
                    disabled={busy}
                    style={({ pressed }) => [styles.btnOk, pressed && { opacity: 0.9 }]}
                  >
                    {busy ? (
                      <ActivityIndicator color={colors.bg} size="small" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={20} color={colors.bg} />
                        <Text style={styles.btnOkTxt}>Одобрить</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => setRejectModal({ id: item.id })}
                    disabled={busy}
                    style={({ pressed }) => [styles.btnNo, pressed && { opacity: 0.9 }]}
                  >
                    <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
                    <Text style={styles.btnNoTxt}>Отклонить</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}

      {isAdmin && section === "users" && (
        <FlatList
          data={users}
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
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <View style={styles.userTop}>
                <View style={styles.userMailWrap}>
                  <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.userMail} numberOfLines={1}>
                    {item.email}
                  </Text>
                </View>
                <View
                  style={[
                    styles.rolePill,
                    item.role === "admin" && styles.rolePillAdmin,
                    item.role === "moderator" && styles.rolePillMod,
                  ]}
                >
                  <Text style={styles.rolePillTxt}>{roleRu(item.role)}</Text>
                </View>
              </View>
              {item.role === "admin" ? (
                <Text style={styles.protected}>Системная учётная запись</Text>
              ) : (
                <View style={styles.roleActions}>
                  <Pressable
                    onPress={() =>
                      Alert.alert("Роль «Пользователь»?", item.email, [
                        { text: "Отмена", style: "cancel" },
                        {
                          text: "Да",
                          onPress: () => void setUserRole(item.id, "user"),
                        },
                      ])
                    }
                    style={({ pressed }) => [styles.roleBtn, pressed && { opacity: 0.88 }]}
                  >
                    <Text style={styles.roleBtnTxt}>Пользователь</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      Alert.alert("Роль «Модератор»?", item.email, [
                        { text: "Отмена", style: "cancel" },
                        {
                          text: "Да",
                          onPress: () => void setUserRole(item.id, "moderator"),
                        },
                      ])
                    }
                    style={({ pressed }) => [styles.roleBtnAccent, pressed && { opacity: 0.88 }]}
                  >
                    <Text style={styles.roleBtnAccentTxt}>Модератор</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        />
      )}

      <Modal visible={!!rejectModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Причина отклонения</Text>
            <Text style={styles.modalHint}>Необязательно, видно автору объявления</Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Кратко укажите причину…"
              placeholderTextColor={colors.textMuted}
              style={styles.modalInput}
              multiline
            />
            <View style={styles.modalRow}>
              <Pressable
                onPress={() => {
                  setRejectModal(null);
                  setRejectReason("");
                }}
                style={styles.modalCancel}
              >
                <Text style={styles.modalCancelTxt}>Отмена</Text>
              </Pressable>
              <Pressable onPress={() => void submitReject()} style={styles.modalDanger}>
                <Text style={styles.modalDangerTxt}>Отклонить</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
  },
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.text,
    letterSpacing: -0.3,
  },
  heroSub: {
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  segments: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  seg: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  segOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  segTxt: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted },
  segTxtOn: { color: colors.bg },
  modBadge: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: colors.accentDim,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  modBadgeTxt: { fontFamily: fonts.medium, fontSize: 13, color: colors.accent },
  list: { padding: spacing.lg, gap: spacing.md },
  empty: {
    textAlign: "center",
    marginTop: spacing.xl,
    fontFamily: fonts.regular,
    color: colors.textMuted,
    fontSize: 15,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  cardAccent: {
    height: 3,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
  cardRow: { flexDirection: "row", padding: spacing.md },
  thumb: { width: 100, height: 100, borderRadius: radii.md },
  thumbPh: {
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, marginLeft: spacing.md, minWidth: 0 },
  owner: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.gold,
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
  },
  meta: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  price: {
    marginTop: spacing.sm,
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.accent,
  },
  km: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, marginTop: 2 },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    paddingTop: 0,
  },
  btnOk: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  btnOkTxt: { fontFamily: fonts.semibold, fontSize: 15, color: colors.bg },
  btnNo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger,
    paddingVertical: 12,
    borderRadius: radii.md,
  },
  btnNoTxt: { fontFamily: fonts.semibold, fontSize: 15, color: colors.danger },
  userCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  userTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  userMailWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  userMail: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, flex: 1 },
  rolePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  rolePillAdmin: { backgroundColor: "rgba(212,185,120,0.2)" },
  rolePillMod: { backgroundColor: colors.accentDim },
  rolePillTxt: { fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  protected: {
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  roleActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
  },
  roleBtnTxt: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  roleBtnAccent: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.accentDim,
    alignItems: "center",
  },
  roleBtnAccentTxt: { fontFamily: fonts.semibold, fontSize: 14, color: colors.accent },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  modalTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  modalHint: {
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  modalInput: {
    marginTop: spacing.md,
    minHeight: 88,
    textAlignVertical: "top",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
  },
  modalRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  modalCancelTxt: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  modalDanger: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: radii.md,
    backgroundColor: "rgba(255,107,107,0.2)",
  },
  modalDangerTxt: { fontFamily: fonts.semibold, fontSize: 15, color: colors.danger },
});
