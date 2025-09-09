import mongoose from "mongoose";

const pushSubscriptionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        // Entire PushSubscription JSON object from the browser
        subscription: {
            endpoint: { type: String, required: true, index: true },
            expirationTime: { type: Number, default: null },
            keys: {
                p256dh: { type: String, required: true },
                auth: { type: String, required: true },
            },
        },
        userAgent: { type: String, default: "" },
        enabled: { type: Boolean, default: true },
        lastSentAt: { type: Date, default: null },
        lastErrorAt: { type: Date, default: null },
    },
    { timestamps: true }
);

// Useful indexes
pushSubscriptionSchema.index({ userId: 1 });
pushSubscriptionSchema.index({ "subscription.endpoint": 1 }, { unique: true, sparse: true });

export default mongoose.model("PushSubscription", pushSubscriptionSchema);


