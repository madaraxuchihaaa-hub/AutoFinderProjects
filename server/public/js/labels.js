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
