import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { apiGet, apiPost } from "../api/client";
import { registerAccessTokenGetter } from "../auth/tokenBridge";
import type { AuthUser, MobileLoginResponse } from "../types/api";
import { colors, fonts, radii, spacing } from "../theme";

const TOKEN_KEY = "autofinder_access_token";

type CatalogItem = {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  price_rub: string | number;
  city: string | null;
};

type CatalogPage = {
  items: CatalogItem[];
  total: number;
  page: number;
  limit: number;
};

export default function MobileShell() {
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [catalog, setCatalog] = useState<CatalogPage | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [listErr, setListErr] = useState<string | null>(null);

  useEffect(() => {
    registerAccessTokenGetter(async () => token);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!cancelled) setToken(t);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoadingList(true);
    setListErr(null);
    try {
      const data = await apiGet<CatalogPage>("/api/listings?page=1&limit=30");
      setCatalog(data);
    } catch (e) {
      setListErr(e instanceof Error ? e.message : "Ошибка загрузки каталога");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog, token]);

  async function onLogin() {
    setErr(null);
    setBusy(true);
    try {
      const data = await apiPost<MobileLoginResponse>(
        "/api/mobile/login",
        { email: email.trim(), password },
        { auth: false }
      );
      await SecureStore.setItemAsync(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      setPassword("");
    } catch (e) {
      setErr(
        e instanceof Error ? e.message : "Неверный email или пароль"
      );
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  const bottomPad = useMemo(
    () => Math.max(insets.bottom, Platform.OS === "android" ? 20 : 12),
    [insets.bottom]
  );

  if (!ready) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: bottomPad }]}>
      <View style={styles.header}>
        <Text style={styles.logo}>AutoFinder</Text>
        <Text style={styles.tag}>Тот же API, что и у веб-клиента</Text>
      </View>

      <View style={styles.authCard}>
        {!token ? (
          <>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="email"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            <Text style={[styles.label, { marginTop: spacing.sm }]}>Пароль</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <Pressable
              onPress={() => void onLogin()}
              disabled={busy}
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}
            >
              {busy ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={styles.btnText}>Войти (JWT)</Text>
              )}
            </Pressable>
          </>
        ) : (
          <View>
            <Text style={styles.ok}>Вход выполнен. Каталог ниже.</Text>
            {user ? (
              <Text style={styles.userLine}>
                {user.full_name || user.email} · {user.role}
              </Text>
            ) : null}
            <Pressable onPress={() => void onLogout()} style={styles.outline}>
              <Text style={styles.outlineText}>Выйти</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text style={styles.sectionTitle}>Каталог</Text>
      {loadingList && !catalog ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
      ) : (
        <FlatList
          data={catalog?.items ?? []}
          keyExtractor={(it) => it.id}
          refreshing={loadingList}
          onRefresh={() => void loadCatalog()}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {listErr ?? "Нет опубликованных объявлений"}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.rowMeta}>
                {item.price_rub} ₽ · {item.brand} {item.model} · {item.year}
                {item.city ? ` · ${item.city}` : ""}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  header: { marginBottom: spacing.md },
  logo: {
    fontFamily: fonts.bold,
    fontSize: 26,
    color: colors.text,
  },
  tag: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  authCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  label: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginBottom: 6 },
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
  err: { marginTop: spacing.sm, color: colors.danger, fontFamily: fonts.regular, fontSize: 13 },
  btn: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.bg },
  ok: { fontFamily: fonts.semibold, fontSize: 14, color: colors.success },
  userLine: { marginTop: 6, fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  outline: {
    marginTop: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  outlineText: { fontFamily: fonts.medium, color: colors.accent },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  rowMeta: { marginTop: 4, fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing.lg },
});
