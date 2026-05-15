export type Locale = "ru" | "en";

const dict = {
  ru: {
    tabHome: "Главная",
    tabMarket: "Рынок",
    tabMenu: "Меню",
    menuGarage: "Гараж",
    menuProfile: "Профиль",
    menuAdmin: "Админ-панель",
    menuModeration: "Модерация",
    menuNewListing: "Новое объявление",
    menuPlatforms: "Площадки",
    menuSettings: "Настройки",
    settingsTitle: "Настройки",
    theme: "Тема",
    themeDark: "Тёмная",
    themeLight: "Светлая",
    language: "Язык",
    langRu: "Русский",
    langEn: "English",
    brand: "Марка",
    model: "Модель",
    pickFromList: "Выберите из списка",
    noMatches: "Ничего не найдено",
  },
  en: {
    tabHome: "Home",
    tabMarket: "Market",
    tabMenu: "Menu",
    menuGarage: "Garage",
    menuProfile: "Profile",
    menuAdmin: "Admin panel",
    menuModeration: "Moderation",
    menuNewListing: "New listing",
    menuPlatforms: "Platforms",
    menuSettings: "Settings",
    settingsTitle: "Settings",
    theme: "Theme",
    themeDark: "Dark",
    themeLight: "Light",
    language: "Language",
    langRu: "Русский",
    langEn: "English",
    brand: "Brand",
    model: "Model",
    pickFromList: "Pick from list",
    noMatches: "No matches",
  },
} as const;

export type I18nKey = keyof (typeof dict)["ru"];

export function t(locale: Locale, key: I18nKey): string {
  return dict[locale][key] ?? dict.ru[key];
}
