import fs from "node:fs";
import path from "node:path";
import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../../config/prisma.config.js";
import { collateralService } from "../../services/collateral.service.js";
import { successResponse } from "../../utils/responseHandler.utils.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { paginate } from "../../utils/pagination.utils.js";
import { formatUploadedFile } from "../../middlewares/upload.middleware.js";
import { FileType } from "../../generated/prisma/enums.js";
import { getFileUrl } from "../../utils/fileHandling.utils.js";

/**
 * Helper to enrich collateral fileUrl, icon, and mediaItems with full URLs via getFileUrl
 */
export async function transformCollateralUrls(item: any): Promise<any> {
    if (!item || typeof item !== "object") return item;

    const icon = item.icon ? (await getFileUrl(item.icon)) || item.icon : item.icon;
    const fileUrl = item.fileUrl ? (await getFileUrl(item.fileUrl)) || item.fileUrl : item.fileUrl;

    let mediaItems = item.mediaItems;
    if (Array.isArray(mediaItems)) {
        mediaItems = await Promise.all(
            mediaItems.map(async (m: any) => ({
                ...m,
                fileUrl: m.fileUrl ? (await getFileUrl(m.fileUrl)) || m.fileUrl : m.fileUrl,
            })),
        );
    }

    return {
        ...item,
        icon,
        fileUrl,
        ...(mediaItems !== undefined && { mediaItems }),
    };
}

/**
 * Get all collaterals with optional query filters (platterId, projectId, status, code) and pagination
 */
export const getCollaterals = asyncHandler(async (req: Request, res: Response) => {
    const { platterId, projectId, status, code, page, limit, all } = req.query;

    const filter: any = {};
    if (platterId) filter.platterId = String(platterId);
    if (projectId) filter.projectId = String(projectId);
    if (status !== undefined) filter.status = status === "true";
    if (code) filter.code = String(code);

    const pageNum = page ? Number(page) : all === "true" ? undefined : 1;
    const limitNum = limit ? Number(limit) : all === "true" ? undefined : 10;

    if (pageNum !== undefined) {
        const result = await paginate(
            prisma.projectCollateral,
            {
                where: filter,
                orderBy: { seq: "asc" as const },
                include: {
                    platter: true,
                    project: true,
                    mediaItems: {
                        orderBy: { seq: "asc" },
                    },
                },
            },
            { page: pageNum, limit: limitNum || 10 },
        );
        const transformedItems = await Promise.all(result.data.map(transformCollateralUrls));
        successResponse(res, 200, "Collaterals fetched successfully", {
            ...result,
            data: transformedItems,
        });
        return;
    }

    const collaterals = await collateralService.getAllCollaterals(filter);
    const transformed = await Promise.all(collaterals.map(transformCollateralUrls));
    successResponse(res, 200, "Collaterals fetched successfully", transformed);
});

/**
 * Get active collaterals for a specific platter
 */
export const getActivePlatterCollaterals = asyncHandler(async (req: Request, res: Response) => {
    const platterId = String(req.params.platterId);
    const collaterals = await collateralService.getActiveCollateralsForPlatter(platterId);
    const transformed = await Promise.all(collaterals.map(transformCollateralUrls));
    successResponse(res, 200, "Active platter collaterals fetched successfully", transformed);
});

/**
 * Initialize platter-specific collaterals for a platter
 */
export const initPlatterCollaterals = asyncHandler(async (req: Request, res: Response) => {
    const platterId = String(req.params.platterId);
    await collateralService.ensurePlatterCollaterals(platterId);
    const result = await collateralService.getAllCollaterals({ platterId });
    const transformed = await Promise.all(result.map(transformCollateralUrls));
    successResponse(res, 201, "Platter collaterals initialized successfully", transformed);
});

/**
 * Configure which collaterals are active for a specific platter.
 * Accepts e.g. { activeCodes: ["STORY", "EDM", "BROCHURE"] }
 */
export const configurePlatterCollaterals = asyncHandler(async (req: Request, res: Response) => {
    const platterId = String(req.params.platterId);
    const { activeCodes } = req.body;

    if (!Array.isArray(activeCodes)) {
        throw new ApiError(
            400,
            "activeCodes must be an array of collateral codes (e.g. ['STORY', 'EDM'])",
        );
    }

    const result = await collateralService.configurePlatterCollaterals(platterId, activeCodes);
    const transformed = await Promise.all(result.map(transformCollateralUrls));
    successResponse(
        res,
        200,
        `Platter collaterals configured successfully: [${activeCodes.join(", ")}] active`,
        transformed,
    );
});

/**
 * Get active collaterals for a specific project
 */
export const getActiveProjectCollaterals = asyncHandler(async (req: Request, res: Response) => {
    const projectId = String(req.params.projectId);
    const collaterals = await collateralService.getActiveCollateralsForProject(projectId);
    const transformed = await Promise.all(collaterals.map(transformCollateralUrls));
    successResponse(res, 200, "Active project collaterals fetched successfully", transformed);
});

/**
 * Get single collateral by ID
 */
export const getCollateralById = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const collateral = await collateralService.getCollateralById(id);

    if (!collateral) {
        throw new ApiError(404, "Collateral not found");
    }

    const transformed = await transformCollateralUrls(collateral);
    successResponse(res, 200, "Collateral fetched successfully", transformed);
});

/**
 * Helper to get a single file from req.files (dict/array) or req.file by field names
 */
function getUploadedFile(req: Request, ...fieldNames: string[]): Express.Multer.File | undefined {
    if (req.file && fieldNames.includes(req.file.fieldname)) {
        return req.file;
    }
    if (req.files) {
        if (Array.isArray(req.files)) {
            return req.files.find((f) => fieldNames.includes(f.fieldname));
        }
        const filesDict = req.files as { [fieldname: string]: Express.Multer.File[] };
        for (const name of fieldNames) {
            const list = filesDict[name];
            if (Array.isArray(list) && list.length > 0) {
                return list[0];
            }
        }
    }
    return undefined;
}

/**
 * Create a new collateral
 */
export const createCollateral = asyncHandler(async (req: Request, res: Response) => {
    const {
        platterId,
        projectId,
        code,
        title,
        subtitle,
        icon,
        fileType,
        fileUrl,
        content,
        seq,
        status,
    } = req.body;

    if (!title) {
        throw new ApiError(400, "Collateral title is required");
    }

    let finalIcon = icon;
    let finalFileUrl = fileUrl;
    let finalFileType = fileType as FileType | undefined;

    // Handle uploaded icon file
    const iconFile = getUploadedFile(req, "icon");
    if (iconFile) {
        const iconData = formatUploadedFile(iconFile);
        finalIcon = iconData.url;
    }

    // Handle uploaded collateral file (accepts 'fileUrl' or 'file' field name)
    const collateralFile = getUploadedFile(req, "fileUrl", "file");
    if (collateralFile) {
        const fileData = formatUploadedFile(collateralFile);
        finalFileUrl = fileData.url;
        if (!finalFileType) {
            if (fileData.fileType === "image") finalFileType = FileType.image;
            else if (fileData.fileType === "video") finalFileType = FileType.video;
            else finalFileType = FileType.document;
        }
    }

    const collateral = await collateralService.createCollateral({
        platterId: platterId || null,
        projectId: projectId || null,
        code,
        title,
        subtitle,
        icon: finalIcon,
        fileType: finalFileType,
        fileUrl: finalFileUrl,
        content,
        seq: seq !== undefined ? Number(seq) : 0,
        status:
            status !== undefined
                ? status === true || status === "true" || status === 1 || status === "1"
                : true,
    });

    const result = await collateralService.getCollateralById(collateral.id);
    const transformed = result ? await transformCollateralUrls(result) : collateral;

    successResponse(res, 201, "Collateral created successfully", transformed);
});

/**
 * Update collateral
 */
export const updateCollateral = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const {
        platterId,
        projectId,
        code,
        title,
        subtitle,
        icon,
        fileType,
        fileUrl,
        content,
        seq,
        status,
    } = req.body;

    let finalIcon = icon;
    let finalFileUrl = fileUrl;
    let finalFileType = fileType as FileType | undefined;

    // Handle uploaded icon file
    const iconFile = getUploadedFile(req, "icon");
    if (iconFile) {
        const iconData = formatUploadedFile(iconFile);
        finalIcon = iconData.url;
    }

    // Handle uploaded collateral file (accepts 'fileUrl' or 'file' field name)
    const collateralFile = getUploadedFile(req, "fileUrl", "file");
    if (collateralFile) {
        const fileData = formatUploadedFile(collateralFile);
        finalFileUrl = fileData.url;
        if (!finalFileType) {
            if (fileData.fileType === "image") finalFileType = FileType.image;
            else if (fileData.fileType === "video") finalFileType = FileType.video;
            else finalFileType = FileType.document;
        }
    }

    const updated = await collateralService.updateCollateral(id, {
        platterId,
        projectId,
        code,
        title,
        subtitle,
        icon: finalIcon,
        fileType: finalFileType,
        fileUrl: finalFileUrl,
        content,
        seq: seq !== undefined ? Number(seq) : undefined,
        status:
            status !== undefined
                ? status === true || status === "true" || status === 1 || status === "1"
                : undefined,
    });

    const result = await collateralService.getCollateralById(id);
    const transformed = result ? await transformCollateralUrls(result) : updated;

    successResponse(res, 200, "Collateral updated successfully", transformed);
});

/**
 * Toggle active / inactive status
 */
export const toggleCollateralStatus = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const { status } = req.body;

    const updated = await collateralService.toggleStatus(
        id,
        status !== undefined ? Boolean(status) : undefined,
    );

    successResponse(
        res,
        200,
        `Collateral status updated to ${updated.status ? "ACTIVE" : "INACTIVE"} successfully`,
        updated,
    );
});

/**
 * Configure which collaterals are active for a specific project.
 * Accepts e.g. { activeCodes: ["FLOOR_PLAN", "GALLERY"] }
 */
export const configureProjectCollaterals = asyncHandler(async (req: Request, res: Response) => {
    const projectId = String(req.params.projectId);
    const { activeCodes } = req.body;

    if (!Array.isArray(activeCodes)) {
        throw new ApiError(
            400,
            "activeCodes must be an array of collateral codes (e.g. ['FLOOR_PLAN', 'GALLERY'])",
        );
    }

    const result = await collateralService.configureProjectCollaterals(projectId, activeCodes);
    successResponse(
        res,
        200,
        `Project collaterals configured successfully: [${activeCodes.join(", ")}] active`,
        result,
    );
});

/**
 * Initialize project-specific collaterals for a project
 */
export const initProjectCollaterals = asyncHandler(async (req: Request, res: Response) => {
    const projectId = String(req.params.projectId);
    await collateralService.ensureProjectCollaterals(projectId);
    const result = await collateralService.getAllCollaterals({ projectId });
    successResponse(res, 201, "Project collaterals initialized successfully", result);
});

/**
 * Delete a collateral
 */
export const deleteCollateral = asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    await collateralService.deleteCollateral(id);
    successResponse(res, 200, "Collateral deleted successfully");
});

/**
 * Get all media items for a specific collateral from database
 */
export const getCollateralMedia = asyncHandler(async (req: Request, res: Response) => {
    const collateralId = String(req.params.id);

    const collateral = await prisma.projectCollateral.findUnique({
        where: { id: collateralId },
    });

    if (!collateral) {
        throw new ApiError(404, "Collateral not found");
    }

    const mediaItems = await prisma.collateralMedia.findMany({
        where: { collateralId },
        orderBy: [{ seq: "asc" }, { createdAt: "asc" }],
    });

    const transformedMedia = await Promise.all(
        mediaItems.map(async (m) => ({
            ...m,
            fileUrl: m.fileUrl ? (await getFileUrl(m.fileUrl)) || m.fileUrl : m.fileUrl,
        })),
    );

    successResponse(res, 200, "Collateral media items fetched successfully", {
        collateralId,
        collateralTitle: collateral.title,
        count: transformedMedia.length,
        mediaItems: transformedMedia,
    });
});

/**
 * Add / upload more media items to a collateral
 * Accepts uploaded files (multipart/form-data with 'files' or 'file')
 * OR JSON payload with { mediaItems: [...] } or { fileUrls: [...] }
 */
export const addCollateralMedia = asyncHandler(async (req: Request, res: Response) => {
    const collateralId = String(req.params.id);

    const collateral = await prisma.projectCollateral.findUnique({
        where: { id: collateralId },
    });

    if (!collateral) {
        throw new ApiError(404, "Collateral not found");
    }

    // Count existing media items to continue sequence numbers
    const existingCount = await prisma.collateralMedia.count({
        where: { collateralId },
    });

    const createdRecords: any[] = [];

    // Case A: Multipart uploaded files
    const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
    if (files && files.length > 0) {
        const baseTitle = req.body?.title;
        for (let idx = 0; idx < files.length; idx++) {
            const fileData = formatUploadedFile(files[idx]);

            let fileType: FileType = collateral.fileType || FileType.document;
            if (fileData.fileType === "image") fileType = FileType.image;
            else if (fileData.fileType === "video") fileType = FileType.video;

            const title = baseTitle
                ? files.length > 1
                    ? `${baseTitle} (${idx + 1})`
                    : baseTitle
                : fileData.originalname;

            const record = await prisma.collateralMedia.create({
                data: {
                    collateralId,
                    title,
                    originalName: fileData.originalname,
                    fileName: fileData.filename,
                    fileUrl: fileData.path,
                    fileType,
                    mimeType: fileData.mimetype,
                    fileSize: fileData.size,
                    seq: existingCount + idx,
                    status: true,
                },
            });
            createdRecords.push(record);
        }
    }

    // Case B: JSON body with fileUrls or mediaItems array
    const { fileUrls, mediaItems } = req.body;
    if (Array.isArray(fileUrls)) {
        for (let idx = 0; idx < fileUrls.length; idx++) {
            const url = String(fileUrls[idx]).trim();
            if (!url) continue;

            let fileType: FileType = collateral.fileType || FileType.document;
            if (url.match(/\.(jpg|jpeg|png|webp|gif)$/i)) fileType = FileType.image;
            else if (url.match(/\.(mp4|mov|avi)$/i)) fileType = FileType.video;

            const record = await prisma.collateralMedia.create({
                data: {
                    collateralId,
                    title: `${collateral.title} (${existingCount + createdRecords.length + 1})`,
                    fileName: path.basename(url),
                    fileUrl: url,
                    fileType,
                    seq: existingCount + createdRecords.length,
                    status: true,
                },
            });
            createdRecords.push(record);
        }
    } else if (Array.isArray(mediaItems)) {
        for (let idx = 0; idx < mediaItems.length; idx++) {
            const item = mediaItems[idx];
            if (!item.fileUrl) continue;

            const record = await prisma.collateralMedia.create({
                data: {
                    collateralId,
                    title:
                        item.title ||
                        `${collateral.title} (${existingCount + createdRecords.length + 1})`,
                    originalName: item.originalName || null,
                    fileName: item.fileName || path.basename(item.fileUrl),
                    fileUrl: item.fileUrl,
                    fileType: item.fileType || collateral.fileType || FileType.document,
                    mimeType: item.mimeType || null,
                    fileSize: item.fileSize || null,
                    seq:
                        item.seq !== undefined
                            ? Number(item.seq)
                            : existingCount + createdRecords.length,
                    status: item.status !== undefined ? Boolean(item.status) : true,
                },
            });
            createdRecords.push(record);
        }
    }

    if (createdRecords.length === 0) {
        throw new ApiError(
            400,
            "No media files or URLs provided to add. Upload files in 'files' field or pass 'fileUrls' / 'mediaItems' in body.",
        );
    }

    successResponse(
        res,
        201,
        `Added ${createdRecords.length} media item(s) to collateral successfully`,
        {
            collateralId,
            addedCount: createdRecords.length,
            mediaItems: createdRecords,
        },
    );
});

/**
 * Remove a single media item from a collateral (and optionally delete file from disk)
 */
export const removeCollateralMedia = asyncHandler(async (req: Request, res: Response) => {
    const mediaId = String(req.params.mediaId || req.params.id);

    const mediaItem = await prisma.collateralMedia.findUnique({
        where: { id: mediaId },
    });

    if (!mediaItem) {
        throw new ApiError(404, "Collateral media item not found");
    }

    // Delete from database
    await prisma.collateralMedia.delete({
        where: { id: mediaId },
    });

    // Clean up physical file from disk if located inside uploads/
    if (mediaItem.fileUrl) {
        try {
            const cleanPath = mediaItem.fileUrl.replace(/^[\\/]+/, "");
            const fullPath = path.resolve(process.cwd(), cleanPath);
            if (fullPath.includes("uploads") && fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        } catch (err) {
            console.error(`Failed to delete physical file ${mediaItem.fileUrl}:`, err);
        }
    }

    successResponse(res, 200, "Collateral media item removed successfully", {
        deletedId: mediaId,
        deletedFile: mediaItem.fileUrl,
    });
});

/**
 * Update media item title, file, seq, or status
 */
export const updateCollateralMedia = asyncHandler(async (req: Request, res: Response) => {
    const mediaId = String(req.params.mediaId || req.params.id);
    const { title, originalName, fileType, fileUrl, seq, status } = req.body;

    const existingMedia = await prisma.collateralMedia.findUnique({
        where: { id: mediaId },
    });

    if (!existingMedia) {
        throw new ApiError(404, "Collateral media item not found");
    }

    const uploadedFile = getUploadedFile(req, "file", "fileUrl");
    let fileUpdateData: any = {};

    if (uploadedFile) {
        const fileData = formatUploadedFile(uploadedFile);
        let inferredFileType: FileType = FileType.document;
        if (fileData.fileType === "image") inferredFileType = FileType.image;
        else if (fileData.fileType === "video") inferredFileType = FileType.video;

        fileUpdateData = {
            fileName: fileData.filename,
            originalName: uploadedFile.originalname,
            fileUrl: fileData.url,
            fileType: (fileType as FileType) || inferredFileType,
            mimeType: fileData.mimetype,
            fileSize: fileData.size,
        };

        // Clean up previous physical file from disk if it was stored inside uploads/
        if (existingMedia.fileUrl) {
            try {
                const cleanPath = existingMedia.fileUrl.replace(/^[\\/]+/, "");
                const fullPath = path.resolve(process.cwd(), cleanPath);
                if (fullPath.includes("uploads") && fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                }
            } catch (err) {
                console.error(`Failed to delete previous physical file ${existingMedia.fileUrl}:`, err);
            }
        }
    } else if (fileUrl !== undefined) {
        fileUpdateData = {
            fileUrl,
            fileName: path.basename(fileUrl),
            ...(fileType && { fileType: fileType as FileType }),
        };
    } else if (fileType) {
        fileUpdateData = {
            fileType: fileType as FileType,
        };
    }

    const updated = await prisma.collateralMedia.update({
        where: { id: mediaId },
        data: {
            ...(title !== undefined && { title }),
            ...(originalName !== undefined && { originalName }),
            ...(seq !== undefined && { seq: Number(seq) }),
            ...(status !== undefined && {
                status: status === true || status === "true" || status === 1 || status === "1",
            }),
            ...fileUpdateData,
        },
    });

    successResponse(res, 200, "Collateral media item updated successfully", updated);
});
