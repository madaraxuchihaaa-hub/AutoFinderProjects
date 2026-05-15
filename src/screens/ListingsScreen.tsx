import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CommonActions } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { apiGet, resolveMediaUrl } from "../api/client";
import FilterSelect from "../components/FilterSelect";
import VehicleAutocomplete from "../components/VehicleAutocomplete";
import PriceText from "../components/PriceText";
import type { MainTabParamList } from "../navigation/types";
import type { ListingRow } from "../types/api";
import { readPriceByn } from "../types/api";
import { usePreferences } from "../preferences/PreferencesContext";
import type { ThemeColors } from "../theme/colors";
import { fonts, radii, spacing } from "../theme";
import {
  EMPTY_FILTERS,
  filtersToQueryString,
  type ListingFilters,
} from "../utils/listingSearchParams";
import { formatKm } from "../utils/format";

type Props = BottomTabScreenProps<MainTabParamList, "Listings">;

type SearchResponse = { items: ListingRow[]; total: number };

const TRANSMISSION_OPTS = [
  { value: "Механика", label: "Механика" },
  { value: "Автомат", label: "Автомат" },
  { value: "Робот", label: "Робот" },
  { value: "Вариатор", label: "Вариатор" },
];

const BODY_OPTS = [
  { value: "Седан", label: "Седан" },
  { value: "Хэтчбек", label: "Хэтчбек" },
  { value: "Универсал", label: "Универсал" },
  { value: "Купе", label: "Купе" },
  { value: "Кабриолет", label: "Кабриолет" },
  { value: "Внедорожник", label: "Внедорожник" },
  { value: "Кроссовер", label: "Кроссовер" },
  { value: "Минивэн", label: "Минивэн" },
  { value: "Пикап", label: "Пикап" },
  { value: "Лифтбек", label: "Лифтбек" },
];

const FUEL_OPTS = [
  { value: "Бензин", label: "Бензин" },
  { value: "Дизель", label: "Дизель" },
  { value: "Электро", label: "Электро" },
  { value: "Гибрид", label: "Гибрид" },
  { value: "Газ", label: "Газ" },
];

const DRIVE_OPTS = [
  { value: "Передний", label: "Передний" },
  { value: "Задний", label: "Задний" },
  { value: "Полный", label: "Полный" },
];

function RangeInput({
  label,
  from,
  to,
  onFrom,
  onTo,
  keyboard = "default",
  styles,
}: {
  label: string;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  keyboard?: "numeric";
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.rangeBlock}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.rangeRow}>
        <TextInput
          value={from}
          onChangeText={onFrom}
          placeholder="от"
          placeholderTextColor={styles.placeholderColor}
          keyboardType={keyboard === "numeric" ? "numeric" : "default"}
          style={styles.rangeInput}
        />
        <Text style={styles.rangeDash}>—</Text>
        <TextInput
          value={to}
          onChangeText={onTo}
          placeholder="до"
          placeholderTextColor={styles.placeholderColor}
          keyboardType={keyboard === "numeric" ? "numeric" : "default"}
          style={styles.rangeInput}
        />
      </View>
    </View>
  );
}

export default function ListingsScreen({ navigation }: Props) {
  const { colors } = usePreferences();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tabBarHeight = useBottomTabBarHeight();

  const [filters, setFilters] = useState<ListingFilters>({ ...EMPTY_FILTERS });
  const [draft, setDraft] = useState<ListingFilters>({ ...EMPTY_FILTERS });
  const [items, setItems] = useState<ListingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [counting, setCounting] = useState(false);
  const [previewTotal, setPreviewTotal] = useState<number | null>(null);

  const load = useCallback(async (f: ListingFilters) => {
    const qs = filtersToQueryString(f);
    const data = await apiGet<SearchResponse>(`/api/listings?${qs}`, { auth: false });
    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
    setPreviewTotal(data.total ?? 0);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await load(EMPTY_FILTERS);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  useEffect(() => {
    if (loading) return;
    setCounting(true);
    const tmr = setTimeout(() => {
      void (async () => {
        try {
          const qs = filtersToQueryString(draft);
          const data = await apiGet<SearchResponse>(`/api/listings?${qs}`, { auth: false });
          setPreviewTotal(data.total ?? 0);
        } catch {
          setPreviewTotal(null);
        } finally {
          setCounting(false);
        }
      })();
    }, 400);
    return () => clearTimeout(tmr);
  }, [draft, loading]);

  function patchDraft(p: Partial<ListingFilters>) {
    setDraft((prev) => ({ ...prev, ...p }));
  }

  async function applySearch() {
    setSearching(true);
    setFilters({ ...draft });
    try {
      await load(draft);
    } finally {
      setSearching(false);
    }
  }

  function resetFilters() {
    setDraft({ ...EMPTY_FILTERS });
    setFilters({ ...EMPTY_FILTERS });
    void load(EMPTY_FILTERS);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(filters);
    } finally {
      setRefreshing(false);
    }
  }, [filters, load]);

  const header = (
    <View style={styles.panel}>
      <View style={styles.row3}>
        <View style={styles.acBrand}>
          <VehicleAutocomplete
            kind="brand"
            label="Марка"
            value={draft.brand}
            onChange={(v) => patchDraft({ brand: v, model: v !== draft.brand ? "" : draft.model })}
            onSelect={() => patchDraft({ model: "" })}
            placeholder="Любая"
          />
        </View>
        <View style={styles.acModel}>
          <VehicleAutocomplete
            kind="model"
            label="Модель"
            value={draft.model}
            brand={draft.brand}
            onChange={(v) => patchDraft({ model: v })}
            placeholder="Любая"
          />
        </View>
        <View style={styles.genWrap}>
          <Text style={styles.filterLabel}>Поколение</Text>
          <TextInput
            value={draft.generation}
            onChangeText={(v) => patchDraft({ generation: v })}
            placeholder="Любое"
            placeholderTextColor={colors.textMuted}
            style={styles.genInput}
          />
        </View>
      </View>

      <View style={styles.rowYearPrice}>
        <RangeInput
          label="Год"
          from={draft.yearFrom}
          to={draft.yearTo}
          onFrom={(v) => patchDraft({ yearFrom: v })}
          onTo={(v) => patchDraft({ yearTo: v })}
          keyboard="numeric"
          styles={styles}
        />
        <View style={styles.priceBlock}>
          <Text style={styles.filterLabel}>Цена</Text>
          <View style={styles.rangeRow}>
            <TextInput
              value={draft.priceFrom}
              onChangeText={(v) => patchDraft({ priceFrom: v })}
              placeholder="от"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={[styles.rangeInput, styles.priceInput]}
            />
            <Text style={styles.rangeDash}>—</Text>
            <TextInput
              value={draft.priceTo}
              onChangeText={(v) => patchDraft({ priceTo: v })}
              placeholder="до"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={[styles.rangeInput, styles.priceInput]}
            />
          </View>
          <View style={styles.currencyRow}>
            <Pressable
              onPress={() => patchDraft({ currency: "byn" })}
              style={[styles.currencyBtn, draft.currency === "byn" && styles.currencyOn]}
            >
              <Text
                style={[
                  styles.currencyTxt,
                  draft.currency === "byn" && styles.currencyTxtOn,
                ]}
              >
                BYN
              </Text>
            </Pressable>
            <Pressable
              onPress={() => patchDraft({ currency: "usd" })}
              style={[styles.currencyBtn, draft.currency === "usd" && styles.currencyOn]}
            >
              <Text
                style={[
                  styles.currencyTxt,
                  draft.currency === "usd" && styles.currencyTxtOn,
                ]}
              >
                USD
              </Text>
            </Pressable>
          </View>
        </View>
        <RangeInput
          label="Объём, л"
          from={draft.volumeFrom}
          to={draft.volumeTo}
          onFrom={(v) => patchDraft({ volumeFrom: v })}
          onTo={(v) => patchDraft({ volumeTo: v })}
          keyboard="numeric"
          styles={styles}
        />
      </View>

      <View style={styles.row4}>
        <FilterSelect
          label="Коробка"
          value={draft.transmission}
          options={TRANSMISSION_OPTS}
          onChange={(v) => patchDraft({ transmission: v })}
          placeholder="Любая"
        />
        <FilterSelect
          label="Кузов"
          value={draft.bodyType}
          options={BODY_OPTS}
          onChange={(v) => patchDraft({ bodyType: v })}
          placeholder="Любой"
        />
        <FilterSelect
          label="Двигатель"
          value={draft.fuelType}
          options={FUEL_OPTS}
          onChange={(v) => patchDraft({ fuelType: v })}
          placeholder="Любой"
        />
        <FilterSelect
          label="Привод"
          value={draft.drivetrain}
          options={DRIVE_OPTS}
          onChange={(v) => patchDraft({ drivetrain: v })}
          placeholder="Любой"
        />
      </View>

      <View style={styles.actions}>
        <Pressable onPress={resetFilters} style={styles.resetBtn}>
          <Text style={styles.resetTxt}>Сбросить</Text>
        </Pressable>
        <Pressable
          onPress={() => void applySearch()}
          disabled={searching}
          style={({ pressed }) => [styles.showWrap, pressed && { opacity: 0.92 }]}
        >
          <LinearGradient
            colors={[colors.accent, "#2BB8D4"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.showBtn}
          >
            {searching ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.showTxt}>
                {counting && previewTotal === null
                  ? "Подсчёт…"
                  : `Показать ${new Intl.NumberFormat("ru-RU").format(previewTotal ?? total)} объявлений`}
              </Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(it) => it.id}
      contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + spacing.lg }]}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <Text style={styles.empty}>По выбранным параметрам объявлений не найдено</Text>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void onRefresh()}
          tintColor={colors.accent}
          colors={Platform.OS === "android" ? [colors.accent] : undefined}
        />
      }
      renderItem={({ item }) => {
        const uri = resolveMediaUrl(item.images?.[0]);
        return (
          <Pressable
            onPress={() =>
              navigation.getParent()?.dispatch(
                CommonActions.navigate({
                  name: "VehicleDetail",
                  params: { scope: "listing", id: item.id },
                })
              )
            }
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
          >
            {uri ? (
              <Image source={{ uri }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbPh]} />
            )}
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.meta}>
                {[item.brand, item.model, item.year].filter(Boolean).join(" · ")}
              </Text>
              <View style={styles.row}>
                <PriceText priceByn={readPriceByn(item)} size="md" />
                <Text style={styles.km}>{formatKm(item.mileage_km)}</Text>
              </View>
              {item.city ? <Text style={styles.city}>{item.city}</Text> : null}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

function makeStyles(colors: ThemeColors) {
  return {
    ...StyleSheet.create({
      center: {
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: "center",
        justifyContent: "center",
      },
      list: { paddingHorizontal: spacing.lg, gap: spacing.md },
      panel: {
        backgroundColor: colors.bgElevated,
        borderRadius: radii.lg,
        padding: spacing.md,
        marginBottom: spacing.md,
        marginTop: spacing.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        gap: spacing.md,
      },
      row3: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
      acBrand: { flex: 1, minWidth: 0, zIndex: 3 },
      acModel: { flex: 1, minWidth: 0, zIndex: 2 },
      genWrap: { width: 88 },
      genInput: {
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        borderRadius: radii.md,
        paddingHorizontal: spacing.sm,
        paddingVertical: 10,
        fontFamily: fonts.regular,
        fontSize: 13,
        color: colors.text,
        minHeight: 42,
      },
      rowYearPrice: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" },
      rangeBlock: { flex: 1, minWidth: 100 },
      priceBlock: { flex: 1.2, minWidth: 120 },
      filterLabel: {
        fontFamily: fonts.medium,
        fontSize: 11,
        color: colors.textMuted,
        marginBottom: 4,
      },
      rangeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
      rangeInput: {
        flex: 1,
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        borderRadius: radii.md,
        paddingHorizontal: spacing.sm,
        paddingVertical: 8,
        fontFamily: fonts.regular,
        fontSize: 14,
        color: colors.text,
        minHeight: 40,
      },
      priceInput: { minWidth: 56 },
      rangeDash: { color: colors.textMuted, fontSize: 12 },
      currencyRow: { flexDirection: "row", gap: 6, marginTop: 6 },
      currencyBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radii.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
      },
      currencyOn: { backgroundColor: colors.accentDim, borderColor: colors.accent },
      currencyTxt: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
      currencyTxtOn: { color: colors.accent },
      row4: { flexDirection: "row", gap: spacing.sm },
      actions: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
      },
      resetBtn: { paddingVertical: 12, paddingHorizontal: spacing.sm },
      resetTxt: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
      showWrap: { flex: 1 },
      showBtn: {
        borderRadius: radii.md,
        paddingVertical: 14,
        paddingHorizontal: spacing.md,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 48,
      },
      showTxt: {
        fontFamily: fonts.semibold,
        fontSize: 15,
        color: colors.bg,
        textAlign: "center",
      },
      empty: {
        textAlign: "center",
        marginTop: spacing.xl,
        fontFamily: fonts.regular,
        fontSize: 14,
        color: colors.textMuted,
      },
      card: {
        flexDirection: "row",
        backgroundColor: colors.bgElevated,
        borderRadius: radii.lg,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
      },
      thumb: { width: 112, height: 112 },
      thumbPh: { backgroundColor: colors.surface },
      cardBody: { flex: 1, padding: spacing.md, justifyContent: "center" },
      cardTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
      meta: {
        marginTop: 4,
        fontFamily: fonts.regular,
        fontSize: 12,
        color: colors.textMuted,
      },
      row: {
        flexDirection: "row",
        alignItems: "baseline",
        gap: spacing.md,
        marginTop: spacing.sm,
      },
      km: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
      city: {
        marginTop: 4,
        fontFamily: fonts.regular,
        fontSize: 12,
        color: colors.gold,
      },
    }),
    placeholderColor: colors.textMuted,
  };
}
