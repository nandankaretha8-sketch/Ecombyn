import express from "express";
import auth from "../middleware/auth.js";
import { admin } from "../middleware/Admin.js";
import {
    sendAbandonedCartEmail,
    sendBulkAbandonedCartEmails
} from "../controllers/abandonedCart.controller.js";

const router = express.Router();

// All abandoned cart routes require admin authentication
router.use(auth, admin);

// POST /api/abandoned-cart/send-email - Send abandoned cart email to specific user
router.post('/send-email', sendAbandonedCartEmail);

// POST /api/abandoned-cart/send-bulk-emails - Send bulk abandoned cart emails
router.post('/send-bulk-emails', sendBulkAbandonedCartEmails);

export default router;
