import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { apiGet } from "../api/client";
import type { RootStackParamList } from "../navigation/types";
import { colors, fonts, radii, spacing } from "../theme";
import { formatKm, formatRub } from "../utils/format";

type Props = NativeStackScreenProps<RootStackParamList, "VehicleDetail">;

const GALLERY_W = Dimensions.get("window").width;
const GALLERY_H = Math.round(GALLERY_W * 0.56);

type AggDetail = {
  id: string;
  feed_id: string | null;
  external_id: string;
  title: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  mileage_km: number | null;
  price_rub: string | number | null;
  city: string | null;
  image_urls: string[];
  fetched_at?: string;
};

type ListingDetail = {
  id: string;
  title: string;
  description: string | null;
  brand: string;
  model: string;
  year: number;
  mileage_km: number | null;
  price_rub: string | number;
  fuel_type: string | null;
  transmission: string | null;
  body_type: string | null;
  city: string | null;
  status: string;
  images: string[];
  reject_reason?: string | null;
};

function listingStatusLabel(status: string): string {
  if (status === "moderation") return "На проверке";
  if (status === "published") return "Опубликовано";
  if (status === "archived") return "Отклонено";
  if (status === "draft") return "Черновик";
  return status;
}

export default function VehicleDetailScreen({ route }: Props) {
  const { scope, id } = route.params;
  const [loading, setLoading] = useState(true);
  const [agg, setAgg] = useState<AggDetail | null>(null);
  const [listing, setListing] = useState<ListingDetail | null>(null);

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (scope === "aggregated" && agg) {
    const images = agg.image_urls?.length ? agg.image_urls : [];
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.body}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.gallery}
        >
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
        <Text style={styles.badge}>Рынок</Text>
        <Text style={styles.title}>{agg.title}</Text>
        <Text style={styles.price}>{formatRub(agg.price_rub)}</Text>
        <View style={styles.grid}>
          <Spec k="Марка / модель" v={[agg.brand, agg.model].filter(Boolean).join(" ") || "—"} />
          <Spec k="Год" v={agg.year != null ? String(agg.year) : "—"} />
          <Spec k="Пробег" v={formatKm(agg.mileage_km)} />
          <Spec k="Город" v={agg.city ?? "—"} />
          <Spec k="ID" v={agg.external_id} />
        </View>
      </ScrollView>
    );
  }

  if (scope === "listing" && listing) {
    const images = listing.images?.length ? listing.images : [];
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.body}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.gallery}
        >
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
        <Text style={styles.badge}>
          {listingStatusLabel(listing.status)}
        </Text>
        <Text style={styles.title}>{listing.title}</Text>
        <Text style={styles.price}>{formatRub(listing.price_rub)}</Text>
        {listing.reject_reason ? (
          <Text style={styles.rejectNote}>{listing.reject_reason}</Text>
        ) : null}
        {listing.description ? (
          <Text style={styles.desc}>{listing.description}</Text>
        ) : null}
        <View style={styles.grid}>
          <Spec k="Марка / модель" v={`${listing.brand} ${listing.model}`} />
          <Spec k="Год" v={String(listing.year)} />
          <Spec k="Пробег" v={formatKm(listing.mileage_km)} />
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
  heroImg: {
    resizeMode: "cover",
    backgroundColor: colors.surface,
  },
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
  price: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.gold,
  },
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
