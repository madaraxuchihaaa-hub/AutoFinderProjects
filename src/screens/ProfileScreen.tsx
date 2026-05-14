import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../auth/AuthContext";
import { apiPatch } from "../api/client";
import type { AuthUser, UserRole } from "../types/api";
import { colors, fonts, radii, spacing } from "../theme";

function roleLabel(role: UserRole): string {
  if (role === "admin") return "Администратор";
  if (role === "moderator") return "Модератор";
  return "Пользователь";
}

export default function ProfileScreen() {
  const { user, refreshUser, logout, setProfileLocal } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const syncFields = useCallback((u: AuthUser | null) => {
    setFullName(u?.full_name ?? "");
    setPhone(u?.phone ?? "");
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshUser();
    }, [refreshUser])
  );

  useEffect(() => {
    syncFields(user);
  }, [user, syncFields]);

  async function saveProfile() {
    setSaving(true);
    try {
      const updated = await apiPatch<AuthUser>("/api/auth/profile", {
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
      });
      setProfileLocal(updated);
      syncFields(updated);
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  function confirmLogout() {
    Alert.alert("Выйти?", "Понадобится снова войти.", [
      { text: "Отмена", style: "cancel" },
      { text: "Выйти", style: "destructive", onPress: () => void logout() },
    ]);
  }

  if (!user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarHeight + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.email}>{user.email}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{roleLabel(user.role)}</Text>
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Имя</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Отображаемое имя"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Телефон</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+7…"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </View>
        <Pressable
          onPress={() => void saveProfile()}
          disabled={saving}
          style={({ pressed }) => [pressed && { opacity: 0.92 }]}
        >
          <LinearGradient
            colors={[colors.accent, "#2BB8D4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cta}
          >
            {saving ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.ctaText}>Сохранить</Text>
            )}
          </LinearGradient>
        </Pressable>
        <Pressable onPress={confirmLogout} style={styles.outlineBtn}>
          <Text style={styles.outlineText}>Выйти</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  email: {
    fontFamily: fonts.semibold,
    fontSize: 17,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentDim,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  badgeText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.accent,
  },
  field: { marginBottom: spacing.md },
  label: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },
  cta: {
    marginTop: spacing.sm,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  ctaText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.bg,
  },
  outlineBtn: {
    marginTop: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  outlineText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.danger,
  },
});
