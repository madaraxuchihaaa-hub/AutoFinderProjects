/** Нормализация госномера РБ: 1234 AB-7 */
export function normalizeByPlate(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, " ");
  const compact = s.replace(/\s/g, "");
  const m = compact.match(/^(\d{4})([A-Z]{2})-?(\d)$/);
  if (m) return `${m[1]} ${m[2]}-${m[3]}`;
  return s;
}

/** Формат: 1234 AB-7 (регион 1–8) */
export function isValidByPlate(raw: string): boolean {
  const n = normalizeByPlate(raw);
  return /^[0-9]{4} [A-Z]{2}-[1-8]$/.test(n);
}

export function validateByPlate(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  if (!isValidByPlate(t)) {
    return "Госномер: формат 1234 AB-7 (4 цифры, 2 латинские буквы, регион 1–8).";
  }
  return null;
}

/** Телефон РБ: +375 XX XXX-XX-XX или 80 XX … */
export function normalizeByPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("375")) {
    return `+${digits}`;
  }
  if (digits.startsWith("80") && digits.length === 11) {
    return `+375${digits.slice(2)}`;
  }
  if (digits.length === 9) {
    return `+375${digits}`;
  }
  return raw.trim();
}

export function isValidByPhone(raw: string): boolean {
  const n = normalizeByPhone(raw);
  return /^\+375(25|29|33|44)\d{7}$/.test(n);
}

export function validateByPhone(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  if (!isValidByPhone(t)) {
    return "Телефон: +375 29 123-45-67 или 80 29 123 45 67 (коды 25, 29, 33, 44).";
  }
  return null;
}
