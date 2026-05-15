import { StyleSheet, Text, View } from "react-native";
import { useExchangeRate } from "../hooks/useExchangeRate";
import { colors, fonts } from "../theme";
import { formatBynWithUsd } from "../utils/format";

type Props = {
  priceByn: string | number | null | undefined;
  size?: "md" | "lg";
};

export default function PriceText({ priceByn, size = "lg" }: Props) {
  const usdPerByn = useExchangeRate();
  const { byn, usd } = formatBynWithUsd(priceByn, usdPerByn);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.byn, size === "md" && styles.bynMd]}>{byn}</Text>
      {usd ? <Text style={styles.usd}>≈ {usd}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  byn: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.gold,
  },
  bynMd: {
    fontSize: 16,
  },
  usd: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textMuted,
  },
});
