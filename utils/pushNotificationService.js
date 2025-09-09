import webpush from "web-push";
import PushSubscriptionModel from "../models/pushSubscription.model.js";
import UserModel from "../models/user.model.js";

// Configure VAPID keys from env or file
let VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    try {
        const fs = await import("fs");
        const path = await import("path");
        const { fileURLToPath } = await import("url");
        
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const filePath = path.join(__dirname, "../vapid-keys.json");
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, "utf-8");
            const vapidKeys = JSON.parse(content);
            VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY || vapidKeys.publicKey;
            VAPID_PRIVATE_KEY = VAPID_PRIVATE_KEY || vapidKeys.privateKey;
        }
    } catch (error) {
        console.error("Error loading VAPID keys:", error);
    }
}

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    try {
        webpush.setVapidDetails(
            `mailto:${process.env.SUPPORT_EMAIL || "support@example.com"}`,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
        );
    } catch (error) {
        console.error("Error setting VAPID details:", error);
    }
}

class PushNotificationService {
    /**
     * Send order status update notification to a specific user
     * @param {string} userId - User ID to send notification to
     * @param {string} orderNumber - Order number
     * @param {string} orderStatus - New order status
     * @param {Object} orderData - Order data for additional context
     * @returns {Promise<Object>} - Result object with success status
     */
    static async sendOrderStatusUpdate(userId, orderNumber, orderStatus, orderData = {}) {
        try {
            if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
                console.warn("VAPID keys not configured, skipping push notification");
                return { success: false, error: "VAPID keys not configured" };
            }

            // Get user's push subscriptions
            const subscriptions = await PushSubscriptionModel.find({ 
                userId, 
                enabled: true 
            }).lean();

            if (subscriptions.length === 0) {
                return { success: false, error: "No active subscriptions found for user" };
            }

            // Get user details for personalization
            const user = await UserModel.findById(userId).select('name email').lean();
            const userName = user?.name || "Customer";

            // Create notification content based on order status
            const notificationContent = this.getOrderStatusNotificationContent(
                orderStatus, 
                orderNumber, 
                userName,
                orderData
            );

            let sentCount = 0;
            let failedCount = 0;
            const invalidEndpoints = [];

            // Send notification to all user's devices
            await Promise.all(
                subscriptions.map(async (subscription) => {
                    const payload = JSON.stringify({
                        title: notificationContent.title,
                        body: notificationContent.body,
                        icon: "/logo-192x192.png",
                        image: notificationContent.image,
                        url: notificationContent.url,
                        tag: `order-${orderNumber}`,
                        data: {
                            type: "order_update",
                            orderId: orderData._id,
                            orderNumber: orderNumber,
                            orderStatus: orderStatus,
                            timestamp: new Date().toISOString()
                        },
                        actions: notificationContent.actions || [],
                        badge: "/logo-192x192.png",
                        requireInteraction: orderStatus === "Delivered" || orderStatus === "Cancelled"
                    });

                    try {
                        await webpush.sendNotification(subscription.subscription, payload, { 
                            TTL: 86400 // 24 hours
                        });
                        sentCount++;
                        
                        // Update last sent timestamp
                        await PushSubscriptionModel.updateOne(
                            { _id: subscription._id }, 
                            { $set: { lastSentAt: new Date() } }
                        );
                    } catch (error) {
                        failedCount++;
                        const statusCode = error?.statusCode || error?.statusCode === 0 ? error.statusCode : null;
                        
                        // Clean up invalid/expired subscriptions
                        if (statusCode === 404 || statusCode === 410) {
                            invalidEndpoints.push(subscription.subscription.endpoint);
                            await PushSubscriptionModel.updateOne(
                                { _id: subscription._id }, 
                                { $set: { enabled: false, lastErrorAt: new Date() } }
                            );
                        }
                        
                        console.error(`Push notification failed for user ${userId}:`, error.message);
                    }
                })
            );

            return {
                success: sentCount > 0,
                data: {
                    sent: sentCount,
                    failed: failedCount,
                    invalidEndpoints: invalidEndpoints,
                    totalSubscriptions: subscriptions.length
                }
            };

        } catch (error) {
            console.error("Error sending order status push notification:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send tracking update notification to a specific user
     * @param {string} userId - User ID to send notification to
     * @param {string} orderNumber - Order number
     * @param {Object} trackingInfo - Tracking information
     * @param {Object} orderData - Order data for additional context
     * @returns {Promise<Object>} - Result object with success status
     */
    static async sendTrackingUpdate(userId, orderNumber, trackingInfo, orderData = {}) {
        try {
            if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
                console.warn("VAPID keys not configured, skipping push notification");
                return { success: false, error: "VAPID keys not configured" };
            }

            // Get user's push subscriptions
            const subscriptions = await PushSubscriptionModel.find({ 
                userId, 
                enabled: true 
            }).lean();

            if (subscriptions.length === 0) {
                return { success: false, error: "No active subscriptions found for user" };
            }

            // Get user details for personalization
            const user = await UserModel.findById(userId).select('name email').lean();
            const userName = user?.name || "Customer";

            const notificationContent = {
                title: "📦 Your Order is On the Way!",
                body: `Hi ${userName}! Your order #${orderNumber} has been shipped and is now trackable.`,
                url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/dashboard/myorders`,
                image: "/assets/shipping-notification.jpg",
                actions: [
                    {
                        action: "track",
                        title: "Track Order",
                        url: trackingInfo.url || `${process.env.FRONTEND_URL || "http://localhost:5173"}/dashboard/myorders`
                    },
                    {
                        action: "view",
                        title: "View Order",
                        url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/dashboard/myorders`
                    }
                ]
            };

            let sentCount = 0;
            let failedCount = 0;
            const invalidEndpoints = [];

            // Send notification to all user's devices
            await Promise.all(
                subscriptions.map(async (subscription) => {
                    const payload = JSON.stringify({
                        title: notificationContent.title,
                        body: notificationContent.body,
                        icon: "/logo-192x192.png",
                        image: notificationContent.image,
                        url: notificationContent.url,
                        tag: `tracking-${orderNumber}`,
                        data: {
                            type: "tracking_update",
                            orderId: orderData._id,
                            orderNumber: orderNumber,
                            trackingNumber: trackingInfo.trackingNumber,
                            partner: trackingInfo.partner,
                            trackingUrl: trackingInfo.url,
                            timestamp: new Date().toISOString()
                        },
                        actions: notificationContent.actions,
                        badge: "/logo-192x192.png",
                        requireInteraction: false
                    });

                    try {
                        await webpush.sendNotification(subscription.subscription, payload, { 
                            TTL: 86400 // 24 hours
                        });
                        sentCount++;
                        
                        // Update last sent timestamp
                        await PushSubscriptionModel.updateOne(
                            { _id: subscription._id }, 
                            { $set: { lastSentAt: new Date() } }
                        );
                    } catch (error) {
                        failedCount++;
                        const statusCode = error?.statusCode || error?.statusCode === 0 ? error.statusCode : null;
                        
                        // Clean up invalid/expired subscriptions
                        if (statusCode === 404 || statusCode === 410) {
                            invalidEndpoints.push(subscription.subscription.endpoint);
                            await PushSubscriptionModel.updateOne(
                                { _id: subscription._id }, 
                                { $set: { enabled: false, lastErrorAt: new Date() } }
                            );
                        }
                        
                        console.error(`Push notification failed for user ${userId}:`, error.message);
                    }
                })
            );

            return {
                success: sentCount > 0,
                data: {
                    sent: sentCount,
                    failed: failedCount,
                    invalidEndpoints: invalidEndpoints,
                    totalSubscriptions: subscriptions.length
                }
            };

        } catch (error) {
            console.error("Error sending tracking update push notification:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get notification content based on order status
     * @param {string} orderStatus - Order status
     * @param {string} orderNumber - Order number
     * @param {string} userName - User name
     * @param {Object} orderData - Order data
     * @returns {Object} - Notification content
     */
    static getOrderStatusNotificationContent(orderStatus, orderNumber, userName, orderData) {
        const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        
        switch (orderStatus) {
            case "Pending":
                return {
                    title: "🛒 Order Confirmed!",
                    body: `Hi ${userName}! Your order #${orderNumber} has been confirmed and is being processed.`,
                    url: `${baseUrl}/dashboard/myorders`,
                    image: "/assets/order-confirmed.jpg",
                    actions: [
                        {
                            action: "view",
                            title: "View Order",
                            url: `${baseUrl}/dashboard/myorders`
                        }
                    ]
                };

            case "Confirmed":
                return {
                    title: "✅ Order Confirmed!",
                    body: `Hi ${userName}! Your order #${orderNumber} has been confirmed and is being prepared for shipping.`,
                    url: `${baseUrl}/dashboard/myorders`,
                    image: "/assets/order-confirmed.jpg",
                    actions: [
                        {
                            action: "view",
                            title: "View Order",
                            url: `${baseUrl}/dashboard/myorders`
                        }
                    ]
                };

            case "Shipped":
                return {
                    title: "📦 Order Shipped!",
                    body: `Hi ${userName}! Your order #${orderNumber} has been shipped and is on its way to you.`,
                    url: `${baseUrl}/dashboard/myorders`,
                    image: "/assets/order-shipped.jpg",
                    actions: [
                        {
                            action: "track",
                            title: "Track Order",
                            url: `${baseUrl}/dashboard/myorders`
                        }
                    ]
                };

            case "Out for Delivery":
                return {
                    title: "🚚 Out for Delivery!",
                    body: `Hi ${userName}! Your order #${orderNumber} is out for delivery and will arrive soon!`,
                    url: `${baseUrl}/dashboard/myorders`,
                    image: "/assets/out-for-delivery.jpg",
                    actions: [
                        {
                            action: "track",
                            title: "Track Order",
                            url: `${baseUrl}/dashboard/myorders`
                        }
                    ]
                };

            case "Delivered":
                return {
                    title: "🎉 Order Delivered!",
                    body: `Hi ${userName}! Your order #${orderNumber} has been successfully delivered. Thank you for shopping with us!`,
                    url: `${baseUrl}/dashboard/myorders`,
                    image: "/assets/order-delivered.jpg",
                    actions: [
                        {
                            action: "review",
                            title: "Leave Review",
                            url: `${baseUrl}/dashboard/myorders`
                        },
                        {
                            action: "shop",
                            title: "Shop Again",
                            url: `${baseUrl}/`
                        }
                    ]
                };

            case "Cancelled":
                return {
                    title: "❌ Order Cancelled",
                    body: `Hi ${userName}! Your order #${orderNumber} has been cancelled. If you have any questions, please contact our support team.`,
                    url: `${baseUrl}/dashboard/myorders`,
                    image: "/assets/order-cancelled.jpg",
                    actions: [
                        {
                            action: "support",
                            title: "Contact Support",
                            url: `${baseUrl}/dashboard/support`
                        },
                        {
                            action: "shop",
                            title: "Shop Again",
                            url: `${baseUrl}/`
                        }
                    ]
                };

            default:
                return {
                    title: "📋 Order Update",
                    body: `Hi ${userName}! Your order #${orderNumber} status has been updated to ${orderStatus}.`,
                    url: `${baseUrl}/dashboard/myorders`,
                    image: "/assets/order-update.jpg",
                    actions: [
                        {
                            action: "view",
                            title: "View Order",
                            url: `${baseUrl}/dashboard/myorders`
                        }
                    ]
                };
        }
    }

    /**
     * Send bulk notifications to multiple users
     * @param {Array} userIds - Array of user IDs
     * @param {string} title - Notification title
     * @param {string} body - Notification body
     * @param {Object} options - Additional options
     * @returns {Promise<Object>} - Result object with success status
     */
    static async sendBulkNotification(userIds, title, body, options = {}) {
        try {
            if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
                console.warn("VAPID keys not configured, skipping push notification");
                return { success: false, error: "VAPID keys not configured" };
            }

            const subscriptions = await PushSubscriptionModel.find({ 
                userId: { $in: userIds }, 
                enabled: true 
            }).lean();

            if (subscriptions.length === 0) {
                return { success: false, error: "No active subscriptions found" };
            }

            let sentCount = 0;
            let failedCount = 0;
            const invalidEndpoints = [];

            await Promise.all(
                subscriptions.map(async (subscription) => {
                    const payload = JSON.stringify({
                        title,
                        body,
                        icon: options.icon || "/logo-192x192.png",
                        image: options.image,
                        url: options.url,
                        tag: options.tag || "bulk-notification",
                        data: {
                            type: "bulk_notification",
                            ...options.data,
                            timestamp: new Date().toISOString()
                        },
                        actions: options.actions || [],
                        badge: "/logo-192x192.png",
                        requireInteraction: options.requireInteraction || false
                    });

                    try {
                        await webpush.sendNotification(subscription.subscription, payload, { 
                            TTL: options.ttl || 3600 // 1 hour default
                        });
                        sentCount++;
                        
                        await PushSubscriptionModel.updateOne(
                            { _id: subscription._id }, 
                            { $set: { lastSentAt: new Date() } }
                        );
                    } catch (error) {
                        failedCount++;
                        const statusCode = error?.statusCode || error?.statusCode === 0 ? error.statusCode : null;
                        
                        if (statusCode === 404 || statusCode === 410) {
                            invalidEndpoints.push(subscription.subscription.endpoint);
                            await PushSubscriptionModel.updateOne(
                                { _id: subscription._id }, 
                                { $set: { enabled: false, lastErrorAt: new Date() } }
                            );
                        }
                    }
                })
            );

            return {
                success: sentCount > 0,
                data: {
                    sent: sentCount,
                    failed: failedCount,
                    invalidEndpoints: invalidEndpoints,
                    totalSubscriptions: subscriptions.length
                }
            };

        } catch (error) {
            console.error("Error sending bulk push notification:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send new order notification to all admin users
     * @param {Object} orderData - Order data
     * @returns {Promise<Object>} - Result object with success status
     */
    static async sendNewOrderNotificationToAdmins(orderData) {
        try {
            if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
                console.warn("VAPID keys not configured, skipping admin push notification");
                return { success: false, error: "VAPID keys not configured" };
            }

            // Get all admin users
            const adminUsers = await UserModel.find({ role: 'ADMIN' }).select('_id name').lean();
            
            if (adminUsers.length === 0) {
                return { success: false, error: "No admin users found" };
            }

            const adminUserIds = adminUsers.map(admin => admin._id.toString());

            // Get admin push subscriptions
            const subscriptions = await PushSubscriptionModel.find({ 
                userId: { $in: adminUserIds }, 
                enabled: true 
            }).lean();

            if (subscriptions.length === 0) {
                return { success: false, error: "No active admin subscriptions found" };
            }

            // Create notification content
            const notificationContent = {
                title: "🛒 New Order Received!",
                body: `New order #${orderData.orderNumber} from ${orderData.shippingAddress?.name || 'Customer'} - ₹${orderData.totalPrice?.toLocaleString() || '0'}`,
                icon: "/logo-192x192.png",
                url: "/dashboard/orders",
                tag: "new-order-admin",
                data: {
                    type: "new_order_admin",
                    orderId: orderData._id,
                    orderNumber: orderData.orderNumber,
                    customerName: orderData.shippingAddress?.name || 'Customer',
                    totalAmount: orderData.totalPrice,
                    timestamp: new Date().toISOString()
                },
                actions: [
                    {
                        action: "view_order",
                        title: "View Order",
                        icon: "/icons/view-order.png"
                    },
                    {
                        action: "view_orders",
                        title: "All Orders",
                        icon: "/icons/orders.png"
                    }
                ],
                badge: "/logo-192x192.png",
                requireInteraction: true
            };

            let sentCount = 0;
            let failedCount = 0;
            const invalidEndpoints = [];

            // Send notification to all admin devices
            await Promise.all(
                subscriptions.map(async (subscription) => {
                    const payload = JSON.stringify(notificationContent);

                    try {
                        await webpush.sendNotification(subscription.subscription, payload, { 
                            TTL: 3600 // 1 hour
                        });
                        sentCount++;
                    } catch (error) {
                        failedCount++;
                        if (error.statusCode === 410 || error.statusCode === 404) {
                            invalidEndpoints.push(subscription._id);
                        }
                    }
                })
            );

            // Clean up invalid subscriptions
            if (invalidEndpoints.length > 0) {
                await PushSubscriptionModel.deleteMany({ _id: { $in: invalidEndpoints } });
            }

            return {
                success: true,
                sentCount,
                failedCount,
                totalAdmins: adminUsers.length,
                totalSubscriptions: subscriptions.length
            };

        } catch (error) {
            console.error("Error sending new order notification to admins:", error);
            return { success: false, error: error.message };
        }
    }
}

export default PushNotificationService;
