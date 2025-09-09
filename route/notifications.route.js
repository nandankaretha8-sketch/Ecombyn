import express from "express";
import auth from "../middleware/auth.js";
import { admin } from "../middleware/Admin.js";
import {
    getPublicKey,
    subscribe,
    unsubscribe,
    notify,
    notifyAbandonedCarts,
    listSubscriptions,
} from "../controllers/notifications.controller.js";

const router = express.Router();

// Public endpoint to retrieve the VAPID public key (safe to expose)
router.get("/public-key", getPublicKey);

// Authenticated user endpoints
router.post("/subscribe", auth, subscribe);
router.delete("/subscribe", auth, unsubscribe);

// Admin-only endpoints
router.post("/notify", auth, admin, notify);
router.post("/notify/abandoned-carts", auth, admin, notifyAbandonedCarts);
router.get("/subscriptions", auth, admin, listSubscriptions);

export default router;


