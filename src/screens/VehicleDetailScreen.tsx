import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CommonActions } from "@react-navigation/native";
import { apiGet, apiPost, resolveMediaUrl } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useSavedListings } from "../hooks/useSavedListings";
import PriceText from "../components/PriceText";
import type { RootStackParamList } from "../navigation/types";
import { readPriceByn } from "../types/api";
import { colors, fonts, radii, spacing } from "../theme";
import { formatKm } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "VehicleDetail">;

const GALLERY_W = Dimensions.get("window").width;
const GALLERY_H = Math.round(GALLERY_W * 0.56);

type AggDetail = {
  id: string;
  title: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  mileage_km: number | null;
  price_byn?: string | number | null;
  price_rub?: string | number | null;
  city: string | null;
  image_urls: string[];
  external_id?: string;
};

type ListingDetail = {
  id: string;
  title: string;
  description: string | null;
  brand: string;
  model: string;
  year: number;
  mileage_km: number | null;
  price_byn?: string | number;
  price_rub?: string | number;
  fuel_type: string | null;
  transmission: string | null;
  body_type: string | null;
  trim_level?: string | null;
  interior?: string | null;
  interior_details?: string | null;
  safety_systems?: string | null;
  plate_number?: string | null;
  city: string | null;
  status: string;
  images: string[];
  reject_reason?: string | null;
  owner_id?: string;
  owner_name?: string | null;
  owner_phone?: string | null;
};

function listingStatusLabel(status: string): string {
  if (status === "moderation") return "На проверке";
  if (status === "published") return "Опубликовано";
  if (status === "archived") return "Отклонено";
  if (status === "draft") return "Черновик";
  return status;
}

export default function VehicleDetailScreen({ route, navigation }: Props) {
  const { scope, id } = route.params;
  const { user, token } = useAuth();
  const { isFavorite, isCompared, toggleFavorite, toggleCompare } = useSavedListings();
  const [loading, setLoading] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);
  const [agg, setAgg] = useState<AggDetail | null>(null);
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [chatBusy, setChatBusy] = useState(false);

  useEffect(() => {
    let m = true;
    (async () => {
      try {
        if (scope === "aggregated") {
          const d = await apiGet<AggDetail>(`/api/aggregated/${id}`);
          if (m) setAgg(d);
        } else {
          const d = await apiGet<ListingDetail>(`/api/listings/${id}`);
          if (m) setListing(d);
        }
      } catch {
        if (m) {
          setAgg(null);
          setListing(null);
        }
      } finally {
        if (m) setLoading(false);
      }
    })();
    return () => {
      m = false;
    };
  }, [scope, id]);

  async function startChat(listingId: string) {
    if (!token) {
      Alert.alert("Вход", "Войдите, чтобы написать продавцу.");
      return;
    }
    setChatBusy(true);
    try {
      const conv = await apiPost<{ id: string }>("/api/conversations", { listing_id: listingId });
      navigation.dispatch(
        CommonActions.navigate({
          name: "ChatDetail",
          params: {
            conversationId: conv.id,
            title: listing?.owner_name ?? "Продавец",
            listingTitle: listing?.title,
          },
        })
      );
    } catch (e) {
      Alert.alert("Ошибка", e instanceof Error ? e.message : "Не удалось открыть чат");
    } finally {
      setChatBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (scope === "aggregated" && agg) {
    const images = (agg.image_urls ?? [])
      .map((u) => resolveMediaUrl(u))
      .filter((u): u is string => Boolean(u));
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.body}>
        <Gallery images={images} />
        <Text style={styles.badge}>Рынок</Text>
        <Text style={styles.title}>{agg.title}</Text>
        <View style={styles.priceWrap}>
          <PriceText priceByn={readPriceByn(agg)} />
        </View>
        <View style={styles.grid}>
          <Spec k="Марка / модель" v={[agg.brand, agg.model].filter(Boolean).join(" ") || "—"} />
          <Spec k="Год" v={agg.year != null ? String(agg.year) : "—"} />
          <Spec k="Пробег" v={formatKm(agg.mileage_km)} />
          <Spec k="Город" v={agg.city ?? "—"} />
        </View>
      </ScrollView>
    );
  }

  if (scope === "listing" && listing) {
    const images = (listing.images ?? [])
      .map((u) => resolveMediaUrl(u))
      .filter((u): u is string => Boolean(u));
    const isOwner = user?.id === listing.owner_id;
    const canChat =
      listing.status === "published" && !isOwner && listing.owner_id;

    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.body}>
        <Gallery images={images} />
        <Text style={styles.badge}>{listingStatusLabel(listing.status)}</Text>
        <Text style={styles.title}>{listing.title}</Text>
        <View style={styles.priceWrap}>
          <PriceText priceByn={readPriceByn(listing)} />
        </View>
        {listing.reject_reason ? (
          <Text style={styles.rejectNote}>{listing.reject_reason}</Text>
        ) : null}
        {listing.description ? <Text style={styles.desc}>{listing.description}</Text> : null}

        {listing.status === "published" && !isOwner ? (
          <View style={styles.saveRow}>
            <Pressable
              disabled={saveBusy}
              onPress={() => {
                if (!token) {
                  Alert.alert("Вход", "Войдите, чтобы сохранять объявления.");
                  return;
                }
                setSaveBusy(true);
                void toggleFavorite(listing.id).finally(() => setSaveBusy(false));
              }}
              style={({ pressed }) => [
                styles.btnOutline,
                isFavorite(listing.id) && styles.btnOutlineActive,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.btnOutlineTxt}>
                {isFavorite(listing.id) ? "В избранном" : "В избранное"}
              </Text>
            </Pressable>
            <Pressable
              disabled={saveBusy}
              onPress={() => {
                if (!token) {
                  Alert.alert("Вход", "Войдите, чтобы сравнивать объявления.");
                  return;
                }
                setSaveBusy(true);
                void toggleCompare(listing.id)
                  .then((r) => {
                    if (r === "limit") {
                      Alert.alert("Сравнение", "Не больше 3 объявлений в сравнении.");
                    }
                  })
                  .finally(() => setSaveBusy(false));
              }}
              style={({ pressed }) => [
                styles.btnOutline,
                isCompared(listing.id) && styles.btnOutlineActive,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.btnOutlineTxt}>
                {isCompared(listing.id) ? "В сравнении" : "Сравнить"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {(canChat || listing.owner_phone) && (
          <View style={styles.actions}>
            {canChat ? (
              <Pressable
                onPress={() => void startChat(listing.id)}
                disabled={chatBusy}
                style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.9 }]}
              >
                {chatBusy ? (
                  <ActivityIndicator color={colors.bg} />
                ) : (
                  <Text style={styles.btnPrimaryTxt}>Написать продавцу</Text>
                )}
              </Pressable>
            ) : null}
            {listing.owner_phone ? (
              <Pressable
                onPress={() => void Linking.openURL(`tel:${listing.owner_phone}`)}
                style={({ pressed }) => [styles.btnOutline, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.btnOutlineTxt}>{listing.owner_phone}</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <View style={styles.grid}>
          <Spec k="Марка / модель" v={`${listing.brand} ${listing.model}`} />
          <Spec k="Год" v={String(listing.year)} />
          <Spec k="Пробег" v={formatKm(listing.mileage_km)} />
          <Spec k="Комплектация" v={listing.trim_level ?? "—"} />
          <Spec k="Салон" v={listing.interior ?? "—"} />
          {listing.interior_details ? (
            <Spec k="Характеристики салона" v={listing.interior_details} />
          ) : null}
          {listing.safety_systems ? (
            <Spec k="Системы безопасности" v={listing.safety_systems} />
          ) : null}
          {listing.plate_number ? <Spec k="Госномер" v={listing.plate_number} /> : null}
          <Spec k="Топливо" v={listing.fuel_type ?? "—"} />
          <Spec k="КПП" v={listing.transmission ?? "—"} />
          <Spec k="Кузов" v={listing.body_type ?? "—"} />
          <Spec k="Город" v={listing.city ?? "—"} />
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.center}>
      <Text style={styles.miss}>Карточка не найдена</Text>
    </View>
  );
}

function Gallery({ images }: { images: string[] }) {
  return (
    <>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.gallery}>
        {images.map((uri) => (
          <Image
            key={uri}
            source={{ uri }}
            style={[styles.heroImg, { width: GALLERY_W, height: GALLERY_H }]}
          />
        ))}
      </ScrollView>
      {images.length === 0 ? (
        <View
          style={[
            styles.heroImg,
            { width: GALLERY_W, height: GALLERY_H, alignSelf: "center" },
            styles.ph,
          ]}
        />
      ) : null}
    </>
  );
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.spec}>
      <Text style={styles.specK}>{k}</Text>
      <Text style={styles.specV}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { paddingBottom: spacing.xl * 2 },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  miss: { fontFamily: fonts.medium, color: colors.textMuted },
  gallery: { maxHeight: 320 },
  heroImg: { resizeMode: "cover", backgroundColor: colors.surface },
  ph: { marginHorizontal: spacing.lg },
  badge: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    alignSelf: "flex-start",
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.accent,
    backgroundColor: colors.accentDim,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    textTransform: "uppercase",
  },
  title: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.text,
  },
  priceWrap: { marginTop: spacing.sm, marginHorizontal: spacing.lg },
  rejectNote: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
  },
  desc: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  saveRow: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  actions: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  btnPrimary: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  btnPrimaryTxt: { fontFamily: fonts.semibold, fontSize: 16, color: colors.bg },
  btnOutline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnOutlineTxt: { fontFamily: fonts.semibold, fontSize: 15, color: colors.accent },
  btnOutlineActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  grid: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  spec: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  specK: { fontFamily: fonts.regular, color: colors.textMuted, flexShrink: 0 },
  specV: {
    fontFamily: fonts.medium,
    color: colors.text,
    textAlign: "right",
    flex: 1,
  },
});
