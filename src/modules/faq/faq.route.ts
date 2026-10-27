import { Router } from "express";
import { faqController } from "./faq.controller.js";

const router = Router();

// /api/faqs or /api/v1/faqs
router.get("/", faqController.getFaqs);
router.get("/:id", faqController.getFaqById);
router.post("/", faqController.createFaq);
router.put("/:id", faqController.updateFaq);
router.delete("/:id", faqController.deleteFaq);

export const FaqRoutes = router;
