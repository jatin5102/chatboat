import multer from "multer";
import path from "path";
import fs from "fs";

const BASE_UPLOAD_DIR = path.join(process.cwd(), "uploads");

export const createUploader = (folder: string = "common") => {
  const uploadDir = path.join(BASE_UPLOAD_DIR, folder);

  fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, uploadDir),

    filename: (req: any, file: any, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname);
      const filename = `${unique}${ext}`;
      file.key = `${folder}/${filename}`;

      cb(null, filename);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
    },
    fileFilter: (_, file, cb) => {
      const allowed = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
        "video/mp4",
        "video/webm",
        "video/ogg",
        "video/quicktime",
        "video/x-msvideo",
      ];

      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Invalid file type"));
      }
    },
  });
};
