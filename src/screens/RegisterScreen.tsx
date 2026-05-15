import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../auth/AuthContext";
import type { RootStackParamList } from "../navigation/types";
import { colors, fonts, radii, spacing } from "../theme";
import { BY_PHONE_HINT, validateByPhone } from "../utils/validation";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit() {
    setErr(null);
    if (password.length < 8) {
      setErr("Пароль не короче 8 символов.");
      return;
    }
    const phoneErr = validateByPhone(phone);
    if (phone.trim() && phoneErr) {
      setErr(phoneErr);
      return;
    }
    setBusy(true);
    try {
      await register({
        email: email.trim(),
        password,
        full_name: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка регистрации");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {err ? <Text style={styles.err}>{err}</Text> : null}
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Пароль</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Минимум 8 символов"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Имя (необязательно)</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Как к вам обращаться"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Телефон (необязательно)</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+375 29 123-45-67"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            style={styles.input}
          />
          <Text style={styles.hint}>{BY_PHONE_HINT}</Text>
        </View>
        <Pressable onPress={onSubmit} disabled={busy} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
          <LinearGradient
            colors={[colors.accent, "#2BB8D4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cta}
          >
            {busy ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.ctaText}>Создать аккаунт</Text>
            )}
          </LinearGradient>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={styles.linkWrap} hitSlop={12}>
          <Text style={styles.link}>Уже есть аккаунт — войти</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  err: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  field: { marginBottom: spacing.md },
  label: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
  },
  hint: {
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textMuted,
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
    marginTop: spacing.md,
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
  linkWrap: { marginTop: spacing.lg, alignItems: "center" },
  link: { fontFamily: fonts.medium, fontSize: 15, color: colors.accent },
});
