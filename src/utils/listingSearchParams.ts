export type ListingFilters = {
  brand: string;
  model: string;
  generation: string;
  yearFrom: string;
  yearTo: string;
  priceFrom: string;
  priceTo: string;
  currency: "byn" | "usd";
  volumeFrom: string;
  volumeTo: string;
  transmission: string;
  bodyType: string;
  fuelType: string;
  drivetrain: string;
};

export const EMPTY_FILTERS: ListingFilters = {
  brand: "",
  model: "",
  generation: "",
  yearFrom: "",
  yearTo: "",
  priceFrom: "",
  priceTo: "",
  currency: "byn",
  volumeFrom: "",
  volumeTo: "",
  transmission: "",
  bodyType: "",
  fuelType: "",
  drivetrain: "",
};

export function filtersToQueryString(f: ListingFilters): string {
  const p = new URLSearchParams();
  p.set("search", "1");
  if (f.brand.trim()) p.set("brand", f.brand.trim());
  if (f.model.trim()) p.set("model", f.model.trim());
  if (f.generation.trim()) p.set("generation", f.generation.trim());
  if (f.yearFrom.trim()) p.set("year_from", f.yearFrom.trim());
  if (f.yearTo.trim()) p.set("year_to", f.yearTo.trim());
  if (f.priceFrom.trim()) p.set("price_from", f.priceFrom.trim().replace(/\s/g, ""));
  if (f.priceTo.trim()) p.set("price_to", f.priceTo.trim().replace(/\s/g, ""));
  p.set("currency", f.currency);
  if (f.volumeFrom.trim()) p.set("volume_from", f.volumeFrom.trim().replace(",", "."));
  if (f.volumeTo.trim()) p.set("volume_to", f.volumeTo.trim().replace(",", "."));
  if (f.transmission) p.set("transmission", f.transmission);
  if (f.bodyType) p.set("body_type", f.bodyType);
  if (f.fuelType) p.set("fuel_type", f.fuelType);
  if (f.drivetrain) p.set("drivetrain", f.drivetrain);
  p.set("limit", "50");
  return p.toString();
}
