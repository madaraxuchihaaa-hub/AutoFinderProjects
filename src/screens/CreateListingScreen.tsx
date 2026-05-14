import { useState, type ReactNode } from "react";
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
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../auth/AuthContext";
import { apiPost } from "../api/client";
import type { RootStackParamList } from "../navigation/types";
import type { CreateListingResponse } from "../types/api";
import { colors, fonts, radii, spacing } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "CreateListing">;

export default function CreateListingScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [price, setPrice] = useState("");
  const [mileage, setMileage] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [fuel, setFuel] = useState("");
  const [transmission, setTransmission] = useState("");
  const [body, setBody] = useState("");
  const [imagesRaw, setImagesRaw] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const y = Number(year);
    const p = Number(price.replace(/\s/g, "").replace(",", "."));
    if (!title.trim() || !brand.trim() || !model.trim()) {
      Alert.alert("Поля", "Заполните название, марку и модель.");
      return;
    }
    if (!Number.isFinite(y) || y < 1990 || y > 2030) {
      Alert.alert("Год", "Укажите год выпуска 1990–2030.");
      return;
    }
    if (!Number.isFinite(p) || p < 1) {
      Alert.alert("Цена", "Укажите цену в рублях.");
      return;
    }
    const image_urls = imagesRaw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);
    const mileage_km = mileage.trim() ? Number(mileage.replace(/\s/g, "")) : undefined;
    setBusy(true);
    try {
      const res = await apiPost<CreateListingResponse>("/api/listings", {
        title: title.trim(),
        brand: brand.trim(),
        model: model.trim(),
        year: y,
        price_rub: Math.round(p),
        mileage_km:
          mileage_km !== undefined && Number.isFinite(mileage_km)
            ? Math.max(0, mileage_km)
            : undefined,
        city: city.trim() || undefined,
        description: description.trim() || undefined,
        fuel_type: fuel.trim() || undefined,
        transmission: transmission.trim() || undefined,
        body_type: body.trim() || undefined,
        image_urls,
      });
      const msg =
        res.status === "moderation"
          ? "Объявление отправлено на проверку. После одобрения модератором оно появится в каталоге и в очереди публикаций."
          : "Объявление опубликовано.";
      Alert.alert("Готово", msg, [
        {
          text: "OK",
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (e) {
      Alert.alert(
        "Ошибка",
        e instanceof Error ? e.message : "Не удалось сохранить"
      );
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
        <Text style={styles.hint}>
          Фото — ссылки HTTPS, по строке или через запятую.
        </Text>
        {user?.role === "user" ? (
          <Text style={styles.hint2}>Обычный пользователь: объявление сначала на модерации.</Text>
        ) : null}
        <Field label="Заголовок" value={title} onChangeText={setTitle} ph="Напр. BMW 320i, один владелец" />
        <Row>
          <FieldSmall label="Марка" value={brand} onChangeText={setBrand} ph="BMW" />
          <FieldSmall label="Модель" value={model} onChangeText={setModel} ph="320i" />
        </Row>
        <Row>
          <FieldSmall label="Год" value={year} onChangeText={setYear} ph="2020" keyboard="numeric" />
          <FieldSmall label="Цена, ₽" value={price} onChangeText={setPrice} ph="2500000" keyboard="numeric" />
        </Row>
        <Row>
          <FieldSmall label="Пробег, км" value={mileage} onChangeText={setMileage} ph="45000" keyboard="numeric" />
          <FieldSmall label="Город" value={city} onChangeText={setCity} ph="Москва" />
        </Row>
        <Field label="Описание" value={description} onChangeText={setDescription} ph="Комплектация, история…" multiline />
        <Row>
          <FieldSmall label="Топливо" value={fuel} onChangeText={setFuel} ph="Бензин" />
          <FieldSmall label="КПП" value={transmission} onChangeText={setTransmission} ph="Автомат" />
        </Row>
        <Field label="Кузов" value={body} onChangeText={setBody} ph="Седан" />
        <Field
          label="Ссылки на фото"
          value={imagesRaw}
          onChangeText={setImagesRaw}
          ph={"https://…jpg\nhttps://…jpg"}
          multiline
        />
        <Pressable onPress={submit} disabled={busy} style={({ pressed }) => [pressed && { opacity: 0.9 }]}>
          <LinearGradient
            colors={[colors.accent, "#2BB8D4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cta}
          >
            {busy ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.ctaText}>Опубликовать и в очередь</Text>
            )}
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  ph,
  multiline,
  keyboard,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  ph: string;
  multiline?: boolean;
  keyboard?: "numeric";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={ph}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multiline && styles.inputMulti]}
        multiline={multiline}
        keyboardType={keyboard === "numeric" ? "numeric" : "default"}
      />
    </View>
  );
}

function FieldSmall({
  label,
  value,
  onChangeText,
  ph,
  keyboard,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  ph: string;
  keyboard?: "numeric";
}) {
  return (
    <View style={[styles.field, styles.fieldGrow]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={ph}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        keyboardType={keyboard === "numeric" ? "numeric" : "default"}
      />
    </View>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 3 },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  hint2: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.accent,
    marginTop: -spacing.md,
    marginBottom: spacing.lg,
  },
  field: { marginBottom: spacing.md },
  fieldGrow: { flex: 1, minWidth: 0 },
  row: { flexDirection: "row", gap: spacing.md },
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
  inputMulti: { minHeight: 88, textAlignVertical: "top" },
  cta: {
    marginTop: spacing.lg,
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
});
