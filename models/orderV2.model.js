import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },
        name: { type: String, required: true },
        image: { type: String, default: "" },
        price: { type: Number, required: true },
        quantity: { type: Number, min: 1, default: 1 },
        // New field for selected size
        selectedSize: { type: String, default: null },
        // New field for selected variant
        selectedVariant: { type: mongoose.Schema.Types.Mixed, default: null },
        // POD (Print on Demand) data
        podData: { type: Map, of: mongoose.Schema.Types.Mixed, default: new Map() },
    },
    { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
    {
        fullName: { type: String, required: true },
        phone: { type: String, required: true },
        address: { type: String, required: true },
        city: { type: String, required: true },
        pincode: { type: String, required: true },
        state: { type: String, required: true },
    },
    { _id: false }
);

const orderV2Schema = new mongoose.Schema(
    {
        orderNumber: {
            type: String,
            index: false, // Prevent automatic index creation
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        orderItems: {
            type: [orderItemSchema],
            validate: [arr => arr.length > 0, "Order must have at least one item"],
        },
        shippingAddress: { type: shippingAddressSchema, required: true },
        paymentMethod: {
            type: String,
            enum: ["CASH_ON_DELIVERY", "CASH ON DELIVERY", "COD", "STRIPE", "RAZORPAY"],
            required: true,
        },
        paymentStatus: {
            type: String,
            enum: ["Pending", "Paid", "Failed"],
            default: "Pending",
        },
        orderStatus: {
            type: String,
            enum: ["Pending", "Confirmed", "Shipped", "Out for Delivery", "Delivered", "Cancelled"],
            default: "Pending",
        },
        subtotal: { type: Number, required: true },
        deliveryCharge: { type: Number, default: 0 },
        totalPrice: { type: Number, required: true },
        tracking: {
            partner: { type: String, default: "" },
            trackingNumber: { type: String, default: "" },
            url: { type: String, default: "" },
            updatedAt: { type: Date }
        },
        coupon: {
            code: { type: String, default: "" },
            discountAmount: { type: Number, default: 0 },
            discountType: { type: String, enum: ["percentage", "fixed"], default: "percentage" },
            discountValue: { type: Number, default: 0 }
        },
        deliveryDate: { 
            type: Date, 
            default: null 
        },
        statusHistory: [{
            status: {
                type: String,
                enum: ["Pending", "Confirmed", "Shipped", "Out for Delivery", "Delivered", "Cancelled"],
                required: true
            },
            updatedAt: {
                type: Date,
                default: Date.now
            },
            updatedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null
            }
        }],
    },
    { timestamps: true }
);

orderV2Schema.index({ user: 1, createdAt: -1 });
orderV2Schema.index({ orderStatus: 1 });
orderV2Schema.index({ paymentStatus: 1 });
orderV2Schema.index({ orderNumber: 1 }, { unique: true, sparse: true });

const OrderV2Model = mongoose.model("OrderV2", orderV2Schema);

export default OrderV2Model;

