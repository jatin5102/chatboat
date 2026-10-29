import {
    PutObjectCommand,
    HeadObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";
import { s3, s3Config } from "../config/s3.config.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "../config/env.config.js";
import fs from "fs";
import path from "path";

export const getPresignedUrl = async (
    key: string,
    expiresInSeconds = 60 * 5, // 5 minutes
): Promise<string> => {
    const command = new GetObjectCommand({
        Bucket: ENV.AWS_S3_BUCKET!,
        Key: key,
    });

    return await getSignedUrl(s3, command, {
        expiresIn: expiresInSeconds,
    });
};

export async function getPresignedUrlForDownload(key: string, expiresIn: number = 60 * 60) {
    const command = new GetObjectCommand({
        Bucket: ENV.AWS_S3_BUCKET!,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${key}"`,
    });

    const url = await getSignedUrl(s3, command, { expiresIn });
    return url;
}

export const deleteFromS3 = async (key: string): Promise<boolean> => {
    if (!key) return false;

    // Extract the relative path from the key/URL
    let relativePath = key;
    if (key.includes("/files/")) {
        relativePath = key.split("/files/").slice(1).join("/files/");
    } else if (key.startsWith("http://") || key.startsWith("https://")) {
        relativePath = key.split("/").at(-1) || "";
    }

    if (!relativePath) return false;

    try {
        const filePath = path.join(process.cwd(), "uploads", relativePath);
        console.log(`Delete Local File: ${filePath}`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch (err) {
        console.error(`Failed to delete local file: ${relativePath}`, err);
        return false;
    }
};

export const deleteFile = async (key: string): Promise<boolean> => {
    if (!key) return false;

    try {
        // console.log(`Deleting local file: ${key}`);
        const filePath = path.join(process.cwd(), "uploads", key);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch (err) {
        console.error(`Error deleting file: ${key}`, err);
        return false;
    }
};

export async function getFileUrl(key: string | undefined | null): Promise<string | null> {
    if (!key) return null;

    const trimmed = String(key).trim();
    if (!trimmed) return null;

    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
    }

    // If it's an emoji or plain string with no file path or extension, return as-is
    const hasPathOrExt =
        trimmed.includes("/") ||
        trimmed.includes("\\") ||
        /\.(png|jpe?g|gif|webp|svg|ico|pdf|mp4|mov|avi|mkv|docx?|xlsx?)$/i.test(trimmed);
    if (!hasPathOrExt) {
        return trimmed;
    }

    const rawBaseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 4002}`;
    const baseUrl = rawBaseUrl.replace(/\/+$/, "");

    // Normalize slashes and remove leading slashes
    const normalized = trimmed.replace(/\\/g, "/").replace(/^\/+/, "");
    const uploadPath = normalized.startsWith("uploads/") ? normalized : `uploads/${normalized}`;

    return `${baseUrl}/${uploadPath}`;
}
