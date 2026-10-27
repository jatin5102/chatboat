import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../../config/prisma.config.js";
import { faqService } from "../../services/faq.service.js";
import { successResponse } from "../../utils/responseHandler.utils.js";
import { paginate } from "../../utils/pagination.utils.js";

export class FaqController {
  /**
   * GET /api/faqs or /api/v1/faqs
   * Query params: ?category=Residential&search=cullinan&page=1&limit=10
   */
  public getFaqs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { category, search, page, limit, all } = req.query;

    const where: any = { status: true };
    if (category) {
      where.category = { equals: String(category), mode: "insensitive" };
    }
    if (search) {
      where.OR = [
        { question: { contains: String(search), mode: "insensitive" } },
        { answer: { contains: String(search), mode: "insensitive" } },
        { keywords: { contains: String(search), mode: "insensitive" } },
      ];
    }

    const pageNum = page ? Number(page) : (all === "true" ? undefined : 1);
    const limitNum = limit ? Number(limit) : (all === "true" ? undefined : 10);

    if (pageNum !== undefined) {
      const result = await paginate(
        prisma.faq,
        { where, orderBy: { seq: "asc" as const } },
        { page: pageNum, limit: limitNum || 10 }
      );
      successResponse(res, 200, "FAQs fetched successfully", result);
      return;
    }

    const faqs = await faqService.getFaqs(
      category ? String(category) : undefined,
      search ? String(search) : undefined
    );

    successResponse(res, 200, "FAQs fetched successfully", faqs);
  });

  /**
   * GET /api/faqs/:id
   */
  public getFaqById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const faq = await faqService.getFaqById(id);

    if (!faq) {
      res.status(404).json({
        success: false,
        message: `FAQ with ID ${id} not found`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: faq,
    });
  });

  /**
   * POST /api/faqs
   */
  public createFaq = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { question, answer, category, keywords, seq, status } = req.body;

    if (!question || !answer) {
      res.status(400).json({
        success: false,
        message: "Both question and answer are required",
      });
      return;
    }

    const created = await faqService.createFaq({
      question,
      answer,
      category,
      keywords,
      seq: seq !== undefined ? Number(seq) : undefined,
      status: status !== undefined ? Boolean(status) : true,
    });

    res.status(201).json({
      success: true,
      message: "FAQ created successfully",
      data: created,
    });
  });

  /**
   * PUT /api/faqs/:id
   */
  public updateFaq = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const existing = await faqService.getFaqById(id);

    if (!existing) {
      res.status(404).json({
        success: false,
        message: `FAQ with ID ${id} not found`,
      });
      return;
    }

    const updated = await faqService.updateFaq(id, req.body);

    res.status(200).json({
      success: true,
      message: "FAQ updated successfully",
      data: updated,
    });
  });

  /**
   * DELETE /api/faqs/:id
   */
  public deleteFaq = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const existing = await faqService.getFaqById(id);

    if (!existing) {
      res.status(404).json({
        success: false,
        message: `FAQ with ID ${id} not found`,
      });
      return;
    }

    await faqService.deleteFaq(id);

    res.status(200).json({
      success: true,
      message: "FAQ deleted successfully",
    });
  });
}

export const faqController = new FaqController();
