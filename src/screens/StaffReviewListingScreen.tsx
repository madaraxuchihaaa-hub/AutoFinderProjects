import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import EquipmentDisplay, { type EquipmentSection } from "../components/EquipmentDisplay";
import PriceText from "../components/PriceText";
import { apiGet, apiPost, resolveMediaUrl } from "../api/client";
import type { RootStackParamList } from "../navigation/types";
import { readPriceByn } from "../types/api";
import { colors, fonts, radii, spacing } from "../theme";
import { formatKm } from "../utils/format";
import { formatEngineMl } from "../utils/listingFormat";

type Props = NativeStackScreenProps<RootStackParamList, "StaffReviewListing">;

type ReviewListing = {
  id: string;
  title: string;
  description: string | null;
  brand: string;
  model: string;
  year: number;
  mileage_km: number | null;
  price_byn?: string | number;
  city: string | null;
  fuel_type: string | null;
  transmission: string | null;
  body_type: string | null;
  engine_volume_ml?: number | null;
  drivetrain?: string | null;
  color?: string | null;
  vin?: string | null;
  trim_level?: string | null;
  plate_number?: string | null;
  show_phone?: boolean;
  images: string[];
  equipment_sections?: EquipmentSection[];
  owner_email: string;
  owner_name: string | null;
  owner_phone: string | null;
  created_at: string;
};

const GALLERY_W = Dimensions.get("window").width - spacing.lg * 2;

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.spec}>
      <Text style={styles.specK}>{label}</Text>
      <Text style={styles.specV}>{value}</Text>
    </View>
  );
}

export default function StaffReviewListingScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [item, setItem] = useState<ReviewListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    const data = await apiGet<ReviewListing>(`/api/staff/pending-listings/${id}`);
    setItem(data);
  }, [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (alive) {
          Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось загрузить");
          navigation.goBack();
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load, navigation]);

  async function approve() {
    setBusy(true);
    try {
      await apiPost(`/api/staff/pending-listings/${id}/approve`, {});
      Alert.alert("Готово", "Объявление опубликовано.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось одобрить");
    } finally {
      setBusy(false);
    }
  }

  async function submitReject() {
    setBusy(true);
    try {
      await apiPost(`/api/staff/pending-listings/${id}/reject`, {
        reason: rejectReason.trim() || undefined,
      });
      setRejectModal(false);
      setRejectReason("");
      Alert.alert("Отклонено", "Автор увидит причину в объявлении.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось отклонить");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !item) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const images = (item.images ?? [])
    .map((u) => resolveMediaUrl(u))
    .filter((u): u is string => Boolean(u));

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {images.length ? (
            images.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.heroImg} />
            ))
          ) : (
            <View style={[styles.heroImg, styles.heroPh]}>
              <Ionicons name="image-outline" size={40} color={colors.textMuted} />
            </View>
          )}
        </ScrollView>

        <View style={styles.ownerBox}>
          <Text style={styles.ownerLabel}>Автор</Text>
          <Text style={styles.ownerEmail}>{item.owner_email}</Text>
          {item.owner_name ? <Text style={styles.ownerMeta}>{item.owner_name}</Text> : null}
          {item.owner_phone ? (
            <Text style={styles.ownerMeta}>Тел.: {item.owner_phone}</Text>
          ) : (
            <Text style={styles.ownerMeta}>Телефон не указан</Text>
          )}
          <Text style={styles.ownerMeta}>
            Показывать телефон в объявлении: {item.show_phone ? "да" : "нет"}
          </Text>
        </View>

        <Text style={styles.title}>{item.title}</Text>
        <PriceText priceByn={readPriceByn(item)} size="lg" />
        <Text style={styles.meta}>
          {[item.brand, item.model, item.year].filter(Boolean).join(" · ")} · {formatKm(item.mileage_km)}
        </Text>
        {item.city ? <Text style={styles.meta}>{item.city}</Text> : null}

        {item.description ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Описание</Text>
            <Text style={styles.desc}>{item.description}</Text>
          </View>
        ) : null}

        {item.equipment_sections?.length ? (
          <EquipmentDisplay sections={item.equipment_sections} />
        ) : null}

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Параметры</Text>
          <Spec label="Топливо" value={item.fuel_type ?? "—"} />
          <Spec label="КПП" value={item.transmission ?? "—"} />
          <Spec label="Кузов" value={item.body_type ?? "—"} />
          <Spec label="Привод" value={item.drivetrain ?? "—"} />
          <Spec label="Объём двигателя" value={formatEngineMl(item.engine_volume_ml)} />
          <Spec label="Цвет" value={item.color ?? "—"} />
          {item.vin ? <Spec label="VIN" value={item.vin} /> : null}
          <Spec label="Комплектация" value={item.trim_level ?? "—"} />
          {item.plate_number ? <Spec label="Госномер" value={item.plate_number} /> : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => void approve()}
          disabled={busy}
          style={({ pressed }) => [styles.btnOk, pressed && { opacity: 0.9 }]}
        >
          {busy ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={22} color={colors.bg} />
              <Text style={styles.btnOkTxt}>Одобрить</Text>
            </>
          )}
        </Pressable>
        <Pressable
          onPress={() => setRejectModal(true)}
          disabled={busy}
          style={({ pressed }) => [styles.btnNo, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
          <Text style={styles.btnNoTxt}>Отклонить</Text>
        </Pressable>
      </View>

      <Modal visible={rejectModal} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Причина отклонения</Text>
            <TextInput
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Кратко укажите причину…"
              placeholderTextColor={colors.textMuted}
              style={styles.modalInput}
              multiline
            />
            <View style={styles.modalRow}>
              <Pressable onPress={() => setRejectModal(false)} style={styles.modalCancel}>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  body: { padding: spacing.lg, paddingBottom: 120 },
  heroImg: {
    width: GALLERY_W,
    height: Math.round(GALLERY_W * 0.65),
    borderRadius: radii.lg,
    marginRight: spacing.sm,
  },
  heroPh: {
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  ownerLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.gold },
  ownerEmail: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text, marginTop: 4 },
  ownerMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 4 },
  title: {
    marginTop: spacing.md,
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.text,
  },
  meta: { marginTop: 6, fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  block: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  blockTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginBottom: spacing.sm },
  desc: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, lineHeight: 22 },
  spec: { marginBottom: 8 },
  specK: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  specV: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, marginTop: 2 },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  btnOk: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: radii.md,
  },
  btnOkTxt: { fontFamily: fonts.semibold, fontSize: 16, color: colors.bg },
  btnNo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger,
    paddingVertical: 14,
    borderRadius: radii.md,
  },
  btnNoTxt: { fontFamily: fonts.semibold, fontSize: 16, color: colors.danger },
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
  modalRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
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
