import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Одна запись в manifest (расширяйте полями по мере необходимости). */
export type TestDataManifestItem = {
  id: string;
  title?: string;
  /** Имена файлов из каталога photos/ (только имя, без подпапок). */
  photoFiles?: string[];
} & Record<string, unknown>;

export type TestDataManifest = {
  version: number;
  description?: string;
  items: TestDataManifestItem[];
};

/** Корень каталога test-data рядом с папкой server (пакет сервера). */
function defaultTestDataRoot(): string {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "test-data");
}

/**
 * Чтение test-data/manifest.json и разрешение путей к локальным фото в test-data/photos/.
 * Пока manifest и photos пустые — методы просто возвращают пустые структуры.
 */
export class TestDataLoader {
  readonly rootDir: string;
  readonly manifestPath: string;
  readonly photosDir: string;

  constructor(rootDir?: string) {
    this.rootDir = rootDir ?? defaultTestDataRoot();
    this.manifestPath = path.join(this.rootDir, "manifest.json");
    this.photosDir = path.join(this.rootDir, "photos");
  }

  manifestExists(): boolean {
    return fs.existsSync(this.manifestPath);
  }

  photosDirExists(): boolean {
    return fs.existsSync(this.photosDir);
  }

  /** Распарсить manifest.json; при отсутствии файла — пустой manifest. */
  loadManifest(): TestDataManifest {
    if (!this.manifestExists()) {
      return { version: 1, items: [] };
    }
    const raw = fs.readFileSync(this.manifestPath, "utf8");
    const data = JSON.parse(raw) as Partial<TestDataManifest>;
    return {
      version: typeof data.version === "number" ? data.version : 1,
      description: typeof data.description === "string" ? data.description : undefined,
      items: Array.isArray(data.items) ? (data.items as TestDataManifestItem[]) : [],
    };
  }

  /**
   * Абсолютный путь к файлу в photos/, если он существует.
   * Принимает только имя файла (без путей), чтобы исключить выход из каталога.
   */
  resolvePhotoPath(fileName: string): string | null {
    const trimmed = fileName.trim();
    if (!trimmed) return null;
    const base = path.basename(trimmed);
    const candidate = path.resolve(this.photosDir, base);
    const root = path.resolve(this.photosDir);
    const rel = path.relative(root, candidate);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) return null;
    return candidate;
  }

  /** Список файлов в photos/ (не рекурсивно), без скрытых имён. */
  listPhotoFiles(): string[] {
    if (!this.photosDirExists()) return [];
    return fs.readdirSync(this.photosDir).filter((name) => {
      if (name.startsWith(".")) return false;
      try {
        return fs.statSync(path.join(this.photosDir, name)).isFile();
      } catch {
        return false;
      }
    });
  }

  /** true, если нет объявлений в manifest (items / listings v2) и нет файлов в photos/. */
  isEmpty(): boolean {
    if (!this.manifestExists()) return this.listPhotoFiles().length === 0;
    const raw = fs.readFileSync(this.manifestPath, "utf8");
    const doc = JSON.parse(raw) as {
      items?: unknown;
      listings?: unknown;
    };
    const nItems = Array.isArray(doc.items) ? doc.items.length : 0;
    const nListings = Array.isArray(doc.listings) ? doc.listings.length : 0;
    return nItems === 0 && nListings === 0 && this.listPhotoFiles().length === 0;
  }
}
