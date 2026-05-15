import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Express, RequestHandler } from "express";
import multer from "multer";

const uploadDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("only_images"));
      return;
    }
    cb(null, true);
  },
});

export function registerUploadRoutes(app: Express, requireAuth: RequestHandler): void {
  app.post("/api/upload/images", requireAuth, (req, res, next) => {
    upload.array("images", 8)(req, res, (err) => {
      if (err) {
        const msg =
          err instanceof Error && err.message === "only_images"
            ? "Допустимы только изображения."
            : "Не удалось загрузить файлы.";
        res.status(400).json({ error: "validation", message: msg });
        return;
      }
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files?.length) {
        res.status(400).json({ error: "validation", message: "Выберите хотя бы одно фото." });
        return;
      }
      const base =
        process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") ||
        `${req.protocol}://${req.get("host")}`;
      const urls = files.map((f) => `${base}/uploads/${f.filename}`);
      res.json({ urls });
    });
  });
}
