/** Подписи как в PHP ListingLabels */
export const FUEL = {
  petrol: "Бензин",
  diesel: "Дизель",
  electric: "Электро",
  hybrid: "Гибрид",
  gas: "Газ",
  other: "Другое",
};

export const TRANS = {
  manual: "Механика",
  automatic: "Автомат",
  robot: "Робот",
  cvt: "Вариатор",
  other: "Другое",
};

export const BODY = {
  sedan: "Седан",
  hatchback: "Хэтчбек",
  suv: "Внедорожник",
  wagon: "Универсал",
  coupe: "Купе",
  van: "Фургон / минивэн",
  pickup: "Пикап",
  motorcycle: "Мотоцикл",
  other: "Другое",
};

export const STATUS = {
  published: "Опубликовано",
  moderation: "На модерации",
  draft: "Черновик",
  rejected: "Отклонено",
  archived: "Архив",
};

export function label(map, key) {
  if (!key) return "—";
  const k = String(key).toLowerCase();
  return map[k] || key;
}

/** Значения фильтров как в мобильном приложении (русские подписи → API ILIKE). */
export const FILTER_TRANS = [
  "Механика",
  "Автомат",
  "Робот",
  "Вариатор",
];
export const FILTER_BODY = [
  "Седан",
  "Хэтчбек",
  "Универсал",
  "Купе",
  "Кабриолет",
  "Внедорожник",
  "Кроссовер",
  "Минивэн",
  "Пикап",
  "Лифтбек",
];
export const FILTER_FUEL = ["Бензин", "Дизель", "Электро", "Гибрид", "Газ"];
export const FILTER_DRIVE = ["Передний", "Задний", "Полный"];

/** Русские варианты из фильтра каталога → ключ body_type в БД. */
export const BODY_FILTER_TO_KEY = {
  Седан: "sedan",
  Хэтчбек: "hatchback",
  Универсал: "wagon",
  Купе: "coupe",
  Кабриолет: "coupe",
  Внедорожник: "suv",
  Кроссовер: "suv",
  Минивэн: "van",
  Пикап: "pickup",
  Лифтбек: "hatchback",
};

/** Нормализация старых URL с русскими подписями → ключи API. */
export function normalizeCatalogFilterQuery(q) {
  const out = { ...q };
  const fuelKey = (v) => {
    if (!v) return "";
    const s = String(v).trim();
    if (FUEL[s]) return s;
    const ent = Object.entries(FUEL).find(([, lab]) => lab === s);
    return ent ? ent[0] : s;
  };
  const transKey = (v) => {
    if (!v) return "";
    const s = String(v).trim();
    if (TRANS[s]) return s;
    const ent = Object.entries(TRANS).find(([, lab]) => lab === s);
    return ent ? ent[0] : s;
  };
  const bodyKey = (v) => {
    if (!v) return "";
    const s = String(v).trim();
    if (BODY[s]) return s;
    const ent = Object.entries(BODY).find(([, lab]) => lab === s);
    if (ent) return ent[0];
    return BODY_FILTER_TO_KEY[s] || s;
  };
  if (out.fuel) out.fuel = fuelKey(out.fuel);
  if (out.transmission) out.transmission = transKey(out.transmission);
  if (out.body) out.body = bodyKey(out.body);
  return out;
}
