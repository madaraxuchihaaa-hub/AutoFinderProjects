import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/AuthContext";
import VehicleAutocomplete, { validateBrandModelChoice } from "../components/VehicleAutocomplete";
import { apiPost, apiUploadImages } from "../api/client";
import type { RootStackParamList } from "../navigation/types";
import type { CreateListingResponse } from "../types/api";
import { colors, fonts, radii, spacing } from "../theme";
import { BY_PLATE_HINT, validateByPlate } from "../utils/validation";

type Props = NativeStackScreenProps<RootStackParamList, "CreateListing">;

const MAX_PHOTOS = 8;

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
  const [trimLevel, setTrimLevel] = useState("");
  const [interior, setInterior] = useState("");
  const [interiorDetails, setInteriorDetails] = useState("");
  const [safetySystems, setSafetySystems] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [showPhone, setShowPhone] = useState(true);
  const [localPhotos, setLocalPhotos] = useState<string[]>([]);
  const [imagesRaw, setImagesRaw] = useState("");
  const [busy, setBusy] = useState(false);

  async function pickPhotos() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Доступ", "Разрешите доступ к галерее в настройках устройства.");
      return;
    }
    const left = MAX_PHOTOS - localPhotos.length;
    if (left <= 0) {
      Alert.alert("Фото", `Максимум ${MAX_PHOTOS} фото.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: left,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    const uris = result.assets.map((a) => a.uri).filter(Boolean);
    setLocalPhotos((prev) => [...prev, ...uris].slice(0, MAX_PHOTOS));
  }

  function removePhoto(uri: string) {
    setLocalPhotos((prev) => prev.filter((u) => u !== uri));
  }

  async function submit() {
    const y = Number(year);
    const p = Number(price.replace(/\s/g, "").replace(",", "."));
    const b = brand.trim();
    const m = model.trim();
    if (!title.trim() || !b || !m) {
      Alert.alert("Поля", "Заполните название, марку и модель.");
      return;
    }
    const catalogOk = await validateBrandModelChoice(b, m);
    if (!catalogOk) {
      Alert.alert("Каталог", "Выберите марку и модель из подсказок списка.");
      return;
    }
    if (!Number.isFinite(y) || y < 1990 || y > 2030) {
      Alert.alert("Год", "Укажите год выпуска 1990–2030.");
      return;
    }
    if (!Number.isFinite(p) || p < 1) {
      Alert.alert("Цена", "Укажите цену в BYN.");
      return;
    }
    const plateErr = validateByPlate(plateNumber);
    if (plateErr) {
      Alert.alert("Госномер", plateErr);
      return;
    }
    const urlFromText = imagesRaw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const mileage_km = mileage.trim() ? Number(mileage.replace(/\s/g, "")) : undefined;
    setBusy(true);
    try {
      let uploaded: string[] = [];
      if (localPhotos.length > 0) {
        uploaded = await apiUploadImages(localPhotos);
      }
      const image_urls = [...uploaded, ...urlFromText].slice(0, MAX_PHOTOS);
      const res = await apiPost<CreateListingResponse>("/api/listings", {
        title: title.trim(),
        brand: b,
        model: m,
        year: y,
        price_byn: Math.round(p),
        mileage_km:
          mileage_km !== undefined && Number.isFinite(mileage_km)
            ? Math.max(0, mileage_km)
            : undefined,
        city: city.trim() || undefined,
        description: description.trim() || undefined,
        fuel_type: fuel.trim() || undefined,
        transmission: transmission.trim() || undefined,
        body_type: body.trim() || undefined,
        trim_level: trimLevel.trim() || undefined,
        interior: interior.trim() || undefined,
        interior_details: interiorDetails.trim() || undefined,
        safety_systems: safetySystems.trim() || undefined,
        plate_number: plateNumber.trim() || undefined,
        show_phone: showPhone,
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
        {user?.role === "user" ? (
          <Text style={styles.hint2}>Обычный пользователь: объявление сначала на модерации.</Text>
        ) : null}
        <Field label="Заголовок" value={title} onChangeText={setTitle} ph="Напр. BMW 320i, один владелец" />
        <VehicleAutocomplete
          kind="brand"
          label="Марка"
          value={brand}
          onChange={(v) => {
            setBrand(v);
            if (model && v !== brand) setModel("");
          }}
          onSelect={() => setModel("")}
          placeholder="BMW"
        />
        <VehicleAutocomplete
          kind="model"
          label="Модель"
          value={model}
          brand={brand}
          onChange={setModel}
          placeholder="320i"
        />
        <Row>
          <FieldSmall label="Год" value={year} onChangeText={setYear} ph="2020" keyboard="numeric" />
          <FieldSmall label="Цена, BYN" value={price} onChangeText={setPrice} ph="45000" keyboard="numeric" />
        </Row>
        <Text style={styles.hintPrice}>Курс USD подставится автоматически в карточке.</Text>
        <Row>
          <FieldSmall label="Пробег, км" value={mileage} onChangeText={setMileage} ph="45000" keyboard="numeric" />
          <FieldSmall label="Город" value={city} onChangeText={setCity} ph="Минск" />
        </Row>
        <Field label="Госномер (необязательно)" value={plateNumber} onChangeText={setPlateNumber} ph="1234 AB-7" />
        <Text style={styles.fieldHint}>{BY_PLATE_HINT}</Text>
        <Field label="Комплектация" value={trimLevel} onChangeText={setTrimLevel} ph="Comfort, M Sport…" />
        <Field label="Салон" value={interior} onChangeText={setInterior} ph="Кожа, ткань, комбинированный…" />
        <Field
          label="Характеристики салона"
          value={interiorDetails}
          onChangeText={setInteriorDetails}
          ph="Подогрев сидений, электрорегулировка, климат…"
          multiline
        />
        <Field
          label="Системы безопасности"
          value={safetySystems}
          onChangeText={setSafetySystems}
          ph={"ABS, ESP, Isofix, антипробуксовочная,\nблокировка задних дверей, TPMS,\nэкстренное торможение, подушки…"}
          multiline
        />
        <Field label="Описание" value={description} onChangeText={setDescription} ph="История, состояние…" multiline />
        <Row>
          <FieldSmall label="Топливо" value={fuel} onChangeText={setFuel} ph="Бензин" />
          <FieldSmall label="КПП" value={transmission} onChangeText={setTransmission} ph="Автомат" />
        </Row>
        <Field label="Кузов" value={body} onChangeText={setBody} ph="Седан" />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Показывать телефон в объявлении</Text>
          <Switch
            value={showPhone}
            onValueChange={setShowPhone}
            trackColor={{ false: colors.border, true: colors.accent }}
          />
        </View>

        <Text style={styles.label}>Фото</Text>
        <Pressable
          onPress={() => void pickPhotos()}
          style={({ pressed }) => [styles.galleryBtn, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="images-outline" size={22} color={colors.accent} />
          <Text style={styles.galleryBtnText}>Выбрать из галереи</Text>
          <Text style={styles.galleryCount}>
            {localPhotos.length}/{MAX_PHOTOS}
          </Text>
        </Pressable>
        {localPhotos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbs}>
            {localPhotos.map((uri) => (
              <View key={uri} style={styles.thumbWrap}>
                <Image source={{ uri }} style={styles.thumb} />
                <Pressable
                  onPress={() => removePhoto(uri)}
                  style={styles.thumbRemove}
                  hitSlop={6}
                >
                  <Ionicons name="close-circle" size={22} color="#fff" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}
        <Field
          label="Или ссылки HTTPS (по строке)"
          value={imagesRaw}
          onChangeText={setImagesRaw}
          ph={"https://…jpg"}
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
  hint2: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.accent,
    marginBottom: spacing.lg,
  },
  hintPrice: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  fieldHint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  switchLabel: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.text,
    marginRight: spacing.md,
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
  inputMulti: { minHeight: 72, textAlignVertical: "top" },
  galleryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.sm,
  },
  galleryBtnText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.text,
  },
  galleryCount: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  thumbs: { marginBottom: spacing.md },
  thumbWrap: { marginRight: spacing.sm, position: "relative" },
  thumb: { width: 88, height: 88, borderRadius: radii.md },
  thumbRemove: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 11,
  },
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
