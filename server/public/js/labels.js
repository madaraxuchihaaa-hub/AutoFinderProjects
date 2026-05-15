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
