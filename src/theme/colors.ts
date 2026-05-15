export type ThemeColors = {
  bg: string;
  bgElevated: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentDim: string;
  gold: string;
  danger: string;
  success: string;
};

export const darkColors: ThemeColors = {
  bg: "#070A0E",
  bgElevated: "#0E141C",
  surface: "#141C28",
  border: "#243044",
  text: "#E8EEF7",
  textMuted: "#8B9BB4",
  accent: "#3EE2FF",
  accentDim: "rgba(62, 226, 255, 0.15)",
  gold: "#D4B978",
  danger: "#FF6B6B",
  success: "#5CE38A",
};

export const lightColors: ThemeColors = {
  bg: "#F4F6FA",
  bgElevated: "#FFFFFF",
  surface: "#EEF1F7",
  border: "#D5DCE8",
  text: "#0E141C",
  textMuted: "#5C6B82",
  accent: "#0A8FB8",
  accentDim: "rgba(10, 143, 184, 0.12)",
  gold: "#9A7B2E",
  danger: "#D64545",
  success: "#1F9D55",
};
