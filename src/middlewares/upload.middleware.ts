import multer from "multer";
import path from "node:path";
import fs from "node:fs";

const ROOT_UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

// Ensure root uploads and subdirectories exist
const subDirs = ["documents", "images", "videos", "collaterals", "properties", "files"];
for (const sub of subDirs) {
    const dirPath = path.join(ROOT_UPLOADS_DIR, sub);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Determine subfolder based on mimetype
 */
function getSubfolder(mimetype: string): string {
    if (mimetype.startsWith("image/")) return "images";
    if (mimetype.startsWith("video/")) return "videos";
    if (
        mimetype === "application/pdf" ||
        mimetype.includes("msword") ||
        mimetype.includes("officedocument") ||
        mimetype.includes("text")
    ) {
        return "documents";
    }
    return "files";
}

const storage = multer.diskStorage({
    destination: (_req, file, cb) => {
        const subfolder = getSubfolder(file.mimetype);
        const destDir = path.join(ROOT_UPLOADS_DIR, subfolder);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        cb(null, destDir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        const baseName = path
            .basename(file.originalname, ext)
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "_")
            .slice(0, 50);
        const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
        cb(null, `${baseName}_${uniqueSuffix}${ext}`);
    },
});

export const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size for high-res PDF / 3D renders / videos
    },
});

/**
 * Helper to construct public and relative path from a multer file
 */
export function formatUploadedFile(file: Express.Multer.File) {
    const relativePath = path.relative(process.cwd(), file.path).replace(/\\/g, "/");

    let fileType = "document";
    if (file.mimetype.startsWith("image/")) fileType = "image";
    else if (file.mimetype.startsWith("video/")) fileType = "video";
    else if (file.mimetype === "application/pdf") fileType = "document";

    return {
        originalname: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        fileType,
        path: relativePath,
        fullPath: file.path,
        url: `/${relativePath}`,
    };
}
