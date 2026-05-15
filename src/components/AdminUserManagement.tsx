import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiDelete, apiGet, apiPatch, apiPost } from "../api/client";
import type {
  AdminUserCreateBody,
  AdminUserRow,
  AdminUserUpdateBody,
  UserRole,
} from "../types/api";
import { useAuth } from "../auth/AuthContext";
import { colors, fonts, radii, spacing } from "../theme";

type EditorMode = "create" | "edit";

type EditorState = {
  mode: EditorMode;
  id?: string;
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: "user" | "moderator";
  is_blocked: boolean;
  protected: boolean;
};

const EMPTY_EDITOR: EditorState = {
  mode: "create",
  email: "",
  password: "",
  full_name: "",
  phone: "",
  role: "user",
  is_blocked: false,
  protected: false,
};

function roleRu(role: UserRole): string {
  if (role === "admin") return "Админ";
  if (role === "moderator") return "Модератор";
  return "Пользователь";
}

function isSystemAccount(item: AdminUserRow): boolean {
  return (
    item.role === "admin" ||
    item.email === "admin@autofinder.local" ||
    item.email === "moderator@autofinder.local"
  );
}

type Props = {
  tabBarInset: number;
};

export default function AdminUserManagement({ tabBarInset }: Props) {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async (q: string) => {
    const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    const data = await apiGet<AdminUserRow[]>(`/api/admin/users${qs}`);
    setUsers(data);
  }, []);

  const reload = useCallback(async () => {
    await loadUsers(query);
  }, [loadUsers, query]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        await loadUsers("");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadUsers]);

  useEffect(() => {
    if (loading) return;
    const tmr = setTimeout(() => {
      void loadUsers(query);
    }, 300);
    return () => clearTimeout(tmr);
  }, [query, loadUsers, loading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadUsers(query);
    } finally {
      setRefreshing(false);
    }
  }, [loadUsers, query]);

  function openCreate() {
    setEditor({ ...EMPTY_EDITOR, mode: "create" });
  }

  function openEdit(item: AdminUserRow) {
    if (item.id === me?.id) {
      Alert.alert("Профиль", "Свою учётку редактируйте в разделе «Профиль».");
      return;
    }
    setEditor({
      mode: "edit",
      id: item.id,
      email: item.email,
      password: "",
      full_name: item.full_name ?? "",
      phone: item.phone ?? "",
      role: item.role === "moderator" ? "moderator" : "user",
      is_blocked: Boolean(item.is_blocked),
      protected: isSystemAccount(item),
    });
  }

  async function saveEditor() {
    if (!editor) return;
    const email = editor.email.trim();
    if (!email.includes("@")) {
      Alert.alert("Email", "Укажите корректный email.");
      return;
    }
    if (editor.mode === "create" && editor.password.length < 8) {
      Alert.alert("Пароль", "Не короче 8 символов.");
      return;
    }
    if (editor.mode === "edit" && editor.password.length > 0 && editor.password.length < 8) {
      Alert.alert("Пароль", "Новый пароль не короче 8 символов.");
      return;
    }

    setSaving(true);
    try {
      if (editor.mode === "create") {
        const body: AdminUserCreateBody = {
          email,
          password: editor.password,
          full_name: editor.full_name.trim() || undefined,
          phone: editor.phone.trim() || undefined,
          role: editor.role,
        };
        await apiPost<AdminUserRow>("/api/admin/users", body);
      } else if (editor.id) {
        const body: AdminUserUpdateBody = {
          email: editor.protected ? undefined : email,
          full_name: editor.full_name.trim() || null,
          phone: editor.phone.trim() || null,
          role: editor.protected ? undefined : editor.role,
          is_blocked: editor.protected ? undefined : editor.is_blocked,
        };
        if (editor.password.length >= 8) {
          body.password = editor.password;
        }
        await apiPatch<AdminUserRow>(`/api/admin/users/${editor.id}`, body);
      }
      setEditor(null);
      await reload();
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(item: AdminUserRow) {
    if (item.id === me?.id) return;
    Alert.alert(
      "Удалить пользователя?",
      `${item.email}\nОбъявления (${item.listings_count ?? 0}) будут удалены.`,
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: () => void deleteUser(item.id),
        },
      ]
    );
  }

  async function deleteUser(id: string) {
    try {
      await apiDelete(`/api/admin/users/${id}`);
      await reload();
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось удалить");
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
    <View style={styles.wrap}>
      <FlatList
        data={users}
        keyExtractor={(it) => it.id}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarInset + 72 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.accent}
            colors={Platform.OS === "android" ? [colors.accent] : undefined}
            progressBackgroundColor={colors.bgElevated}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Поиск: email, имя, телефон"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.count}>Всего: {users.length}</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {query.trim() ? "Никого не найдено" : "Пользователей пока нет"}
          </Text>
        }
        renderItem={({ item }) => {
          const system = isSystemAccount(item);
          const self = item.id === me?.id;
          return (
            <Pressable
              onPress={() => openEdit(item)}
              style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardMain}>
                  <Text style={styles.email} numberOfLines={1}>
                    {item.email}
                  </Text>
                  {item.full_name ? (
                    <Text style={styles.name} numberOfLines={1}>
                      {item.full_name}
                    </Text>
                  ) : null}
                  {item.phone ? (
                    <Text style={styles.phone}>{item.phone}</Text>
                  ) : null}
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
              <View style={styles.metaRow}>
                <Text style={styles.meta}>
                  Объявлений: {item.listings_count ?? 0}
                </Text>
                {item.is_blocked ? (
                  <View style={styles.blockedBadge}>
                    <Text style={styles.blockedTxt}>Заблокирован</Text>
                  </View>
                ) : null}
                {self ? (
                  <Text style={styles.selfTag}>Это вы</Text>
                ) : null}
              </View>
              {system ? (
                <Text style={styles.protected}>Системная учётная запись</Text>
              ) : !self ? (
                <View style={styles.actions}>
                  <Pressable onPress={() => openEdit(item)} style={styles.actionBtn}>
                    <Ionicons name="create-outline" size={18} color={colors.accent} />
                    <Text style={styles.actionTxtAccent}>Изменить</Text>
                  </Pressable>
                  <Pressable onPress={() => confirmDelete(item)} style={styles.actionBtnDanger}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    <Text style={styles.actionTxtDanger}>Удалить</Text>
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />

      <Pressable
        onPress={openCreate}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}
      >
        <Ionicons name="person-add" size={24} color={colors.bg} />
      </Pressable>

      <Modal visible={!!editor} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {editor?.mode === "create" ? "Новый пользователь" : "Редактирование"}
            </Text>
            {editor?.protected ? (
              <Text style={styles.modalHint}>Системная учётка: только имя, телефон и пароль</Text>
            ) : null}

            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              value={editor?.email ?? ""}
              onChangeText={(t) => setEditor((e) => (e ? { ...e, email: t } : e))}
              editable={!editor?.protected}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[styles.input, editor?.protected && styles.inputDisabled]}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.fieldLabel}>
              {editor?.mode === "create" ? "Пароль" : "Новый пароль (пусто — не менять)"}
            </Text>
            <TextInput
              value={editor?.password ?? ""}
              onChangeText={(t) => setEditor((e) => (e ? { ...e, password: t } : e))}
              secureTextEntry
              style={styles.input}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.fieldLabel}>Имя</Text>
            <TextInput
              value={editor?.full_name ?? ""}
              onChangeText={(t) => setEditor((e) => (e ? { ...e, full_name: t } : e))}
              style={styles.input}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.fieldLabel}>Телефон</Text>
            <TextInput
              value={editor?.phone ?? ""}
              onChangeText={(t) => setEditor((e) => (e ? { ...e, phone: t } : e))}
              keyboardType="phone-pad"
              style={styles.input}
              placeholderTextColor={colors.textMuted}
            />

            {!editor?.protected ? (
              <>
                <Text style={styles.fieldLabel}>Роль</Text>
                <View style={styles.roleRow}>
                  <Pressable
                    onPress={() => setEditor((e) => (e ? { ...e, role: "user" } : e))}
                    style={[styles.roleChip, editor?.role === "user" && styles.roleChipOn]}
                  >
                    <Text
                      style={[
                        styles.roleChipTxt,
                        editor?.role === "user" && styles.roleChipTxtOn,
                      ]}
                    >
                      Пользователь
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setEditor((e) => (e ? { ...e, role: "moderator" } : e))}
                    style={[styles.roleChip, editor?.role === "moderator" && styles.roleChipOn]}
                  >
                    <Text
                      style={[
                        styles.roleChipTxt,
                        editor?.role === "moderator" && styles.roleChipTxtOn,
                      ]}
                    >
                      Модератор
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Заблокировать вход</Text>
                  <Switch
                    value={editor?.is_blocked ?? false}
                    onValueChange={(v) =>
                      setEditor((e) => (e ? { ...e, is_blocked: v } : e))
                    }
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor={colors.text}
                  />
                </View>
              </>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setEditor(null)}
                style={styles.modalCancel}
                disabled={saving}
              >
                <Text style={styles.modalCancelTxt}>Отмена</Text>
              </Pressable>
              <Pressable
                onPress={() => void saveEditor()}
                style={styles.modalSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.bg} size="small" />
                ) : (
                  <Text style={styles.modalSaveTxt}>Сохранить</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: spacing.lg, gap: spacing.md },
  header: { marginBottom: spacing.sm },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    paddingVertical: Platform.OS === "ios" ? 11 : 9,
  },
  count: {
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
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
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  cardMain: { flex: 1, minWidth: 0 },
  email: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  name: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  phone: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  rolePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  rolePillAdmin: { backgroundColor: "rgba(212,185,120,0.2)" },
  rolePillMod: { backgroundColor: colors.accentDim },
  rolePillTxt: { fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted },
  blockedBadge: {
    backgroundColor: "rgba(255,107,107,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  blockedTxt: { fontFamily: fonts.medium, fontSize: 11, color: colors.danger },
  selfTag: { fontFamily: fonts.medium, fontSize: 11, color: colors.accent },
  protected: {
    marginTop: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.accentDim,
  },
  actionBtnDanger: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger,
  },
  actionTxtAccent: { fontFamily: fonts.semibold, fontSize: 14, color: colors.accent },
  actionTxtDanger: { fontFamily: fonts.semibold, fontSize: 14, color: colors.danger },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    maxHeight: "92%",
  },
  modalTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  modalHint: {
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  fieldLabel: {
    marginTop: spacing.md,
    marginBottom: 6,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },
  inputDisabled: { opacity: 0.65 },
  roleRow: { flexDirection: "row", gap: spacing.sm },
  roleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center",
  },
  roleChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  roleChipTxt: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted },
  roleChipTxtOn: { color: colors.bg },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  switchLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  modalCancelTxt: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  modalSave: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    justifyContent: "center",
    minHeight: 48,
  },
  modalSaveTxt: { fontFamily: fonts.semibold, fontSize: 15, color: colors.bg },
});
