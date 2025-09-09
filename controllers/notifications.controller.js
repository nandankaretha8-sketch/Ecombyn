import webpush from "web-push";
import PushSubscriptionModel from "../models/pushSubscription.model.js";
import UserModel from "../models/user.model.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Configure VAPID keys from env or file
let VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    try {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, "../vapid-keys.json");
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, "utf-8");
            const vapidKeys = JSON.parse(content);
            VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY || vapidKeys.publicKey;
            VAPID_PRIVATE_KEY = VAPID_PRIVATE_KEY || vapidKeys.privateKey;
        }
    } catch {}
}

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    try {
        webpush.setVapidDetails(
            `mailto:${process.env.SUPPORT_EMAIL || "support@example.com"}`,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
        );
    } catch {}
}

export const getPublicKey = async (req, res) => {
    if (!VAPID_PUBLIC_KEY) {
        return res.status(500).json({ success: false, error: true, message: "VAPID public key not configured" });
    }
    return res.json({ success: true, key: VAPID_PUBLIC_KEY });
};

export const subscribe = async (req, res) => {
    try {
        const userId = req.userId; // set by auth middleware
        if (!userId) {
            return res.status(401).json({ success: false, error: true, message: "Unauthorized" });
        }

        // Ensure we have a plain JSON subscription object
        const rawSub = req.body?.subscription;
        const subscription = rawSub ? JSON.parse(JSON.stringify(rawSub)) : null;
        const userAgent = req.headers["user-agent"] || "";

        if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
            return res.status(400).json({ success: false, error: true, message: "Invalid subscription payload" });
        }

        // Upsert: if endpoint exists, update user/keys; otherwise insert
        let doc = await PushSubscriptionModel.findOne({ "subscription.endpoint": subscription.endpoint });
        if (doc) {
            // If the stored user differs, update it to current user
            doc.userId = userId;
            doc.subscription = subscription;
            doc.userAgent = userAgent;
            doc.enabled = true;
            await doc.save();
        } else {
            // Also ensure one active subscription per user by deactivating previous ones
            await PushSubscriptionModel.updateMany({ userId }, { $set: { enabled: false } });
            doc = await PushSubscriptionModel.create({ userId, subscription, userAgent, enabled: true });
        }

        return res.json({ success: true, message: "Subscribed to push notifications", data: { id: doc._id } });
    } catch (error) {
        return res.status(500).json({ success: false, error: true, message: error.message || "Subscription failed" });
    }
};

export const unsubscribe = async (req, res) => {
    try {
        const endpoint = req.body?.endpoint;
        if (!endpoint) {
            return res.status(400).json({ success: false, error: true, message: "Endpoint required" });
        }
        await PushSubscriptionModel.findOneAndUpdate(
            { "subscription.endpoint": endpoint },
            { enabled: false }
        );
        return res.json({ success: true, message: "Unsubscribed" });
    } catch (error) {
        return res.status(500).json({ success: false, error: true, message: error.message });
    }
};

// Admin-only
export const notify = async (req, res) => {
    try {
        const {
            userIds = [], // optional: array of userIds. if empty and broadcast=true, send to all
            broadcast = false,
            title,
            body,
            icon,
            image,
            url,
            tag,
            data = {},
            ttl = 60,
        } = req.body;

        if (!title || !body) {
            return res.status(400).json({ success: false, error: true, message: "title and body are required" });
        }

        let query = { enabled: true };
        if (!broadcast) {
            if (!Array.isArray(userIds) || userIds.length === 0) {
                return res.status(400).json({ success: false, error: true, message: "userIds required unless broadcast=true" });
            }
            query.userId = { $in: userIds };
        }

        const subs = await PushSubscriptionModel.find(query).lean();
        if (subs.length === 0) {
            return res.json({ success: true, message: "No active subscriptions found", data: { sent: 0, failed: 0 } });
        }

        let sent = 0;
        let failed = 0;
        const invalidEndpoints = [];

        await Promise.all(
            subs.map(async (s) => {
                const payload = JSON.stringify({
                    title,
                    body,
                    icon: icon || "/logo-192x192.png",
                    image,
                    url,
                    tag,
                    data,
                });

                try {
                    await webpush.sendNotification(s.subscription, payload, { TTL: ttl });
                    sent += 1;
                    await PushSubscriptionModel.updateOne({ _id: s._id }, { $set: { lastSentAt: new Date() } });
                } catch (err) {
                    failed += 1;
                    const statusCode = err?.statusCode || err?.statusCode === 0 ? err.statusCode : null;
                    // Clean up invalid/expired subs
                    if (statusCode === 404 || statusCode === 410) {
                        invalidEndpoints.push(s.subscription.endpoint);
                        await PushSubscriptionModel.updateOne({ _id: s._id }, { $set: { enabled: false, lastErrorAt: new Date() } });
                    }
                }
            })
        );

        return res.json({ success: true, message: "Notifications processed", data: { sent, failed, invalidEndpoints } });
    } catch (error) {
        return res.status(500).json({ success: false, error: true, message: error.message });
    }
};

// Helper for abandoned cart targeting (admin)
export const notifyAbandonedCarts = async (req, res) => {
    try {
        const { thresholdMinutes = 60 } = req.body;
        const thresholdDate = new Date(Date.now() - Number(thresholdMinutes) * 60 * 1000);

        // Find users with cart items older than threshold
        const { default: CartProductModel } = await import("../models/cartproduct.model.js");
        const staleCartUserIds = await CartProductModel.aggregate([
            { $match: { updatedAt: { $lt: thresholdDate } } },
            { $group: { _id: "$userId" } },
        ]);

        const userIds = staleCartUserIds.map((d) => d._id).filter(Boolean);
        if (userIds.length === 0) {
            return res.json({ success: true, message: "No abandoned carts beyond threshold", data: { sent: 0, failed: 0 } });
        }

        req.body = {
            ...req.body,
            userIds,
            broadcast: false,
            title: req.body.title || "Complete your purchase",
            body: req.body.body || "You have items waiting in your cart. Checkout now!",
            url: req.body.url || `${(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "")}/cart`,
            tag: req.body.tag || "cart-recovery",
        };

        return await notify(req, res);
    } catch (error) {
        return res.status(500).json({ success: false, error: true, message: error.message });
    }
};

// Admin debug: list active subscriptions (limited)
export const listSubscriptions = async (req, res) => {
    try {
        const [subs, count] = await Promise.all([
            PushSubscriptionModel.find({ enabled: true })
                .select({ "subscription.endpoint": 1, userId: 1, createdAt: 1, updatedAt: 1 })
                .limit(50)
                .lean(),
            PushSubscriptionModel.countDocuments({ enabled: true })
        ]);
        return res.json({ success: true, data: { count, subs } });
    } catch (error) {
        return res.status(500).json({ success: false, error: true, message: error.message });
    }
};


