import OrderV2Model from "../models/orderV2.model.js";
import ProductModel from "../models/product.model.js";
import AddressModel from "../models/address.model.js";
import { applyCouponToOrder } from "./coupon.controller.js";
import { isValidObjectId } from "../utils/objectIdUtils.js";
import razorpay from "../config/razorpay.js";
import UserModel from "../models/user.model.js";
import CartProductModel from "../models/cartproduct.model.js";
import { getCurrencyCode } from "../config/currency.js";
import crypto from 'crypto';
import SiteSettingsModel from "../models/siteSettings.model.js";
import EmailService from "../utils/emailService.js";

const calcPrice = (price, discount = 0) => {
    if (!discount) return Number(price);
    const off = Math.ceil((Number(price) * Number(discount)) / 100);
    return Number(price) - off;
};

const normalizePaymentMethod = (raw) => {
    if (!raw) return null;
    const m = String(raw).trim().toUpperCase();
    if (m === 'COD' || m === 'CASH ON DELIVERY' || m === 'CASH_ON_DELIVERY') return 'CASH_ON_DELIVERY';
    if (m === 'STRIPE') return 'STRIPE';
    if (m === 'RAZORPAY') return 'RAZORPAY';
    return null;
}

// Generate unique order number
const generateOrderNumber = async () => {
    try {
        // Get the latest order to find the highest sequence number
        const latestOrder = await OrderV2Model.findOne({}, {}, { sort: { 'orderNumber': -1 } });
        
        let sequence = 1;
        if (latestOrder && latestOrder.orderNumber) {
            // Extract sequence from existing order number
            const match = latestOrder.orderNumber.match(/ORD\d{8}(\d{4})/);
            if (match) {
                sequence = parseInt(match[1]) + 1;
            }
        }
        
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const sequenceStr = String(sequence).padStart(4, '0');
        
        return `ORD${year}${month}${day}${sequenceStr}`;
    } catch (error) {
        // Fallback: use timestamp if anything fails
        return `ORD${Date.now()}`;
    }
};

// Clean up existing orders with null orderNumber
const cleanupNullOrderNumbers = async () => {
    try {
        const ordersWithNullNumber = await OrderV2Model.find({ orderNumber: { $exists: false } });
        
        for (const order of ordersWithNullNumber) {
            const orderNumber = await generateOrderNumber();
            await OrderV2Model.findByIdAndUpdate(order._id, { orderNumber });
        }
        
        } catch (error) {
        }
};

export const createOrder = async (req, res) => {
    try {
        const userId = req.userId;
        const { orderItems, shippingAddress, couponCode, razorpayPaymentId, razorpayOrderId, razorpaySignature, deliveryCharge = 0, finalTotal } = req.body;
        const paymentMethod = normalizePaymentMethod(req.body.paymentMethod);

        if (!Array.isArray(orderItems) || orderItems.length === 0) {
            return res.status(400).json({ message: "Order must include items", success: false, error: true });
        }
        const required = ["fullName", "phone", "address", "city", "pincode", "state"];
        for (const k of required) {
            if (!shippingAddress?.[k]) {
                return res.status(400).json({ message: `${k} is required in shipping address`, success: false, error: true });
            }
        }
        if (!paymentMethod) {
            return res.status(400).json({ message: "Invalid paymentMethod. Use COD, CASH_ON_DELIVERY, STRIPE or RAZORPAY", success: false, error: true });
        }

        // Batch fetch all products to avoid N+1 queries
        const productIds = orderItems.map(item => item.product || item.productId || item._id);
        
        // Validate all product IDs
        for (const productId of productIds) {
            if (!isValidObjectId(productId)) {
                return res.status(400).json({ 
                    message: `Invalid product ID format: ${productId}`, 
                    success: false, 
                    error: true 
                });
            }
        }
        
        const products = await ProductModel.find({ _id: { $in: productIds } });
        const productMap = new Map(products.map(p => [p._id.toString(), p]));
        
        const normalizedItems = [];
        let subtotal = 0;
        for (const item of orderItems) {
            const productId = item.product || item.productId || item._id;
            const quantity = Number(item.quantity ?? item.qty ?? 1);
            const selectedSize = item.selectedSize || null;
            const selectedVariant = item.selectedVariant || null;
            const podData = item.podData || null;
            
            const product = productMap.get(productId.toString());
            if (!product) {
                return res.status(400).json({ message: `Product ${productId} not found`, success: false, error: true });
            }

            // Handle variant validation for products that have variants
            if (product.hasVariants) {
                if (!selectedVariant) {
                    return res.status(400).json({ 
                        message: `Variant selection is required for ${product.name}`, 
                        success: false, 
                        error: true 
                    });
                }

                const variantData = product.variants.find(variant => variant.name === selectedVariant.name);
                if (!variantData) {
                    return res.status(400).json({ 
                        message: `Selected variant is not available for ${product.name}`, 
                        success: false, 
                        error: true 
                    });
                }

                if (!variantData.isActive) {
                    return res.status(400).json({ 
                        message: `Selected variant is not active for ${product.name}`, 
                        success: false, 
                        error: true 
                    });
                }

                if (variantData.stock < quantity) {
                    return res.status(400).json({ 
                        message: `Insufficient stock for ${product.name} variant ${selectedVariant.name}`, 
                        success: false, 
                        error: true 
                    });
                }
            }
            // Handle size validation for products that require size
            else if (product.requiresSize) {
                if (!selectedSize) {
                    return res.status(400).json({ 
                        message: `Size selection is required for ${product.name}`, 
                        success: false, 
                        error: true 
                    });
                }

                const sizeData = product.sizes.find(size => size.size === selectedSize);
                if (!sizeData) {
                    return res.status(400).json({ 
                        message: `Size ${selectedSize} is not available for ${product.name}`, 
                        success: false, 
                        error: true 
                    });
                }

                if (sizeData.stock < quantity) {
                    return res.status(400).json({ 
                        message: `Insufficient stock for ${product.name} in size ${selectedSize}`, 
                        success: false, 
                        error: true 
                    });
                }
            } else {
                // For products without size or variants, check regular stock
                if (product.stock < quantity) {
                    return res.status(400).json({ 
                        message: `Insufficient stock for ${product.name}`, 
                        success: false, 
                        error: true 
                    });
                }
            }

            // Handle POD validation
            if (product.isPOD && product.podFields && product.podFields.length > 0) {
                if (!podData || typeof podData !== 'object') {
                    return res.status(400).json({ 
                        message: `POD data is required for ${product.name}`, 
                        success: false, 
                        error: true 
                    });
                }

                // Validate each required POD field
                for (const field of product.podFields) {
                    if (field.required) {
                        const fieldValue = podData[field.name]
                        if (!fieldValue || (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
                            return res.status(400).json({ 
                                message: `${field.label} is required for ${product.name}`, 
                                success: false, 
                                error: true 
                            });
                        }
                    }
                }
            }

            // Calculate unit price based on whether variant is selected
            let unitPrice;
            if (selectedVariant) {
                unitPrice = calcPrice(selectedVariant.price, selectedVariant.discount);
            } else {
                unitPrice = calcPrice(product.price, product.discount);
            }
            
            subtotal += unitPrice * quantity;
            normalizedItems.push({
                product: product._id,
                name: product.name,
                image: product.image?.[0] || "",
                price: unitPrice,
                quantity: quantity,
                selectedSize: selectedSize,
                selectedVariant: selectedVariant,
                podData: podData,
            });
        }

        let totalPrice;
        let couponData = {};

        // Use finalTotal from frontend if provided (to avoid double calculation)
        if (finalTotal !== undefined && finalTotal !== null) {
            totalPrice = Number(finalTotal);
            console.log('Using frontend finalTotal (createOrder):', {
                frontendFinalTotal: finalTotal,
                totalPrice
            });
        } else {
            // Fallback to backend calculation if frontend total not provided
            totalPrice = subtotal + Number(deliveryCharge);
            
            // Apply coupon if provided
            if (couponCode) {
                try {
                    // Convert orderItems back to cart items format for coupon calculation with full product data
                    const cartItemsForCoupon = await Promise.all(orderItems.map(async (item) => {
                        const product = await ProductModel.findById(item.product);
                        return {
                            productId: { 
                                _id: product._id,
                                price: product.price,
                                discount: product.discount,
                                category: product.category
                            },
                            quantity: item.quantity,
                            selectedSize: item.selectedSize,
                            podData: item.podData
                        };
                    }));
                    
                    const couponResult = await applyCouponToOrder(couponCode, userId, subtotal, cartItemsForCoupon);
                    totalPrice = couponResult.finalTotal + Number(deliveryCharge);
                    couponData = {
                        code: couponResult.coupon.code,
                        discountAmount: couponResult.discountAmount,
                        discountType: couponResult.coupon.discountType,
                        discountValue: couponResult.coupon.discountValue
                    };
                    
                    // Debug logging
                    console.log('Backend Coupon Debug (createOrder):', {
                        couponCode,
                        subtotal,
                        deliveryCharge,
                        discountAmount: couponResult.discountAmount,
                        finalTotal: couponResult.finalTotal,
                        totalPrice
                    });
                } catch (couponError) {
                    return res.status(400).json({ 
                        message: couponError.message, 
                        success: false, 
                        error: true 
                    });
                }
            }
        }

        // Validate COD limit if payment method is COD
        if (paymentMethod === 'CASH_ON_DELIVERY') {
            try {
                const siteSettings = await SiteSettingsModel.getSettings();
                
                // Check if COD is enabled
                if (!siteSettings.orderSettings?.codEnabled) {
                    return res.status(400).json({ 
                        message: "Cash on Delivery is currently disabled", 
                        success: false, 
                        error: true 
                    });
                }
                
                // Check COD limit
                const codLimit = siteSettings.orderSettings?.codLimit || 0;
                if (totalPrice > codLimit) {
                    return res.status(400).json({ 
                        message: `Cash on Delivery is not available for orders above ₹${codLimit}. Please use online payment for orders above this amount.`, 
                        success: false, 
                        error: true 
                    });
                }
            } catch (settingsError) {
                // If we can't fetch settings, allow the order to proceed
            }
        }

        // Determine payment status based on payment method and Razorpay details
        let paymentStatus = "Pending";
        if (paymentMethod === 'RAZORPAY' && razorpayPaymentId && razorpayOrderId && razorpaySignature) {
            paymentStatus = "Paid";
        }

        const order = await OrderV2Model.create({
            orderNumber: await generateOrderNumber(),
            user: userId,
            orderItems: normalizedItems,
            shippingAddress,
            paymentMethod,
            paymentStatus,
            subtotal,
            deliveryCharge: Number(deliveryCharge),
            totalPrice,
            coupon: couponData,
            statusHistory: [{
                status: 'Pending',
                updatedAt: new Date(),
                updatedBy: userId
            }]
        });

        // Batch update stock using bulk operations
        const bulkOps = [];
        for (const it of normalizedItems) {
            const product = productMap.get(it.product.toString());
            if (product.hasVariants && it.selectedVariant) {
                // Decrement variant-specific stock using arrayFilters for more reliable updates
                bulkOps.push({
                    updateOne: {
                        filter: { 
                            _id: it.product,
                            "variants.name": it.selectedVariant.name,
                            "variants.stock": { $gte: it.quantity }
                        },
                        update: { 
                            $inc: { "variants.$[variant].stock": -it.quantity }
                        },
                        arrayFilters: [
                            { "variant.name": it.selectedVariant.name }
                        ]
                    }
                });
            } else if (product.requiresSize && it.selectedSize) {
                // Decrement size-specific stock
                bulkOps.push({
                    updateOne: {
                        filter: { 
                            _id: it.product,
                            "sizes.size": it.selectedSize,
                            "sizes.stock": { $gte: it.quantity }
                        },
                        update: { $inc: { "sizes.$.stock": -it.quantity } }
                    }
                });
            } else {
                // Decrement regular stock
                bulkOps.push({
                    updateOne: {
                        filter: { 
                            _id: it.product,
                            stock: { $gte: it.quantity }
                        },
                        update: { $inc: { stock: -it.quantity } }
                    }
                });
            }
        }
        
        if (bulkOps.length > 0) {
            const bulkResult = await ProductModel.bulkWrite(bulkOps);
            if (bulkResult.matchedCount !== bulkOps.length) {
                return res.status(400).json({ 
                    message: "Some products are out of stock", 
                    success: false, 
                    error: true 
                });
            }
        }

        // Clear cart after successful order (parallel operations)
        await Promise.all([
            CartProductModel.deleteMany({ userId: userId }),
            UserModel.findByIdAndUpdate(userId, { shopping_cart: [] })
        ]);

        // Send order confirmation email (non-blocking)
        EmailService.sendOrderConfirmationEmail(order).catch(emailError => {
            // Log error for debugging (remove in production)
            // console.error('Order confirmation email error:', emailError);
            // Continue even if email fails
        });

        // Send push notification for order confirmation (non-blocking)
        import('../utils/pushNotificationService.js').then(({ default: PushNotificationService }) => {
            // Send notification to customer
            PushNotificationService.sendOrderStatusUpdate(
                order.user, 
                order.orderNumber, 
                'Pending', 
                order
            ).catch(pushError => {
                // Log error for debugging (remove in production)
                // console.error('Order confirmation push notification error:', pushError);
                // Continue even if push notification fails
            });

            // Send notification to all admins about new order (non-blocking)
            PushNotificationService.sendNewOrderNotificationToAdmins(order).catch(adminPushError => {
                // Log error for debugging (remove in production)
                // console.error('Admin new order push notification error:', adminPushError);
                // Continue even if admin push notification fails
            });
        });

        return res.status(201).json({ message: "Order created", success: true, error: false, data: order });
    } catch (e) {
        return res.status(500).json({ message: e.message || e, success: false, error: true });
    }
};

export const getMyOrders = async (req, res) => {
    try {
        const userId = req.userId;
        const orders = await OrderV2Model.find({ user: userId }).sort({ createdAt: -1 });
        return res.json({ message: "My orders", success: true, error: false, data: orders });
    } catch (e) {
        return res.status(500).json({ message: e.message || e, success: false, error: true });
    }
};

export const getAllOrders = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            q = '',
            status,
            paymentStatus,
            dateFrom,
            dateTo
        } = req.query;

        const filters = {};
        if (status) filters.orderStatus = status;
        if (paymentStatus) filters.paymentStatus = paymentStatus;
        if (dateFrom || dateTo) {
            filters.createdAt = {};
            if (dateFrom) filters.createdAt.$gte = new Date(dateFrom);
            if (dateTo) filters.createdAt.$lte = new Date(dateTo);
        }

        // text-like search on user name/email and item name
        const searchOr = [];
        if (q) {
            searchOr.push({ 'orderItems.name': { $regex: q, $options: 'i' } });
        }

        const query = Object.keys(filters).length ? { ...filters } : {};
        if (searchOr.length) query.$or = searchOr;

        const skip = (Number(page) - 1) * Number(limit);

        const [items, total] = await Promise.all([
            OrderV2Model.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('user', 'name email'),
            OrderV2Model.countDocuments(query)
        ]);

        return res.json({
            message: 'All orders',
            success: true,
            error: false,
            data: items,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });
    } catch (e) {
        return res.status(500).json({ message: e.message || e, success: false, error: true });
    }
};

export const updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { orderStatus, deliveryDate, partner, trackingNumber, url } = req.body;
        if (!orderStatus) return res.status(400).json({ message: 'orderStatus is required', success: false, error: true })

        const current = await OrderV2Model.findById(id)
        if (!current) return res.status(404).json({ message: 'Order not found', success: false, error: true })
        if (current.orderStatus === 'Cancelled' || current.orderStatus === 'Delivered') {
            return res.status(400).json({ message: 'Cannot update a cancelled or delivered order', success: false, error: true })
        }

        const update = { orderStatus };
        if (orderStatus === 'Delivered') {
            update.paymentStatus = 'Paid';
        }
        
        // Add delivery date if provided
        if (deliveryDate) {
            update.deliveryDate = new Date(deliveryDate);
        }

        // Add tracking information if provided
        if (partner || trackingNumber || url) {
            update.tracking = {
                partner: partner || current.tracking?.partner || '',
                trackingNumber: trackingNumber || current.tracking?.trackingNumber || '',
                url: url || current.tracking?.url || '',
                updatedAt: new Date()
            };
        }

        // Add status history entry for the new status
        const statusHistoryEntry = {
            status: orderStatus,
            updatedAt: new Date(),
            updatedBy: req.userId // Admin user ID
        };

        const updated = await OrderV2Model.findByIdAndUpdate(
            id, 
            { 
                $set: update,
                $push: { statusHistory: statusHistoryEntry }
            }, 
            { new: true, runValidators: false }
        );
        if (!updated) return res.status(404).json({ message: 'Order not found', success: false, error: true })
        
                        // Send order status update email
                try {
                    const emailResult = await EmailService.sendOrderStatusEmail(id, orderStatus, updated);
                    if (!emailResult.success) {
                        // Log error for debugging (remove in production)
                        // console.error('Order status email failed:', emailResult.error);
                    }
                } catch (emailError) {
                    // Log error for debugging (remove in production)
                    // console.error('Order status email error:', emailError);
                    // Continue even if email fails
                }

                // Send push notification for order status update
                try {
                    const { default: PushNotificationService } = await import('../utils/pushNotificationService.js');
                    const pushResult = await PushNotificationService.sendOrderStatusUpdate(
                        updated.user, 
                        updated.orderNumber, 
                        orderStatus, 
                        updated
                    );
                    if (!pushResult.success) {
                        // Log error for debugging (remove in production)
                        // console.error('Order status push notification failed:', pushResult.error);
                    }
                } catch (pushError) {
                    // Log error for debugging (remove in production)
                    // console.error('Order status push notification error:', pushError);
                    // Continue even if push notification fails
                }
        
        return res.json({ message: "Status updated", success: true, error: false, data: updated });
    } catch (e) {
        return res.status(500).json({ message: e.message || e, success: false, error: true });
    }
};

export const getOrderStatusHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await OrderV2Model.findById(id).select('statusHistory orderNumber');
        
        if (!order) {
            return res.status(404).json({ 
                message: 'Order not found', 
                success: false, 
                error: true 
            });
        }

        // Sort status history by update time (newest first)
        const sortedHistory = order.statusHistory.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        return res.json({
            message: "Status history retrieved",
            success: true,
            error: false,
            data: {
                orderNumber: order.orderNumber,
                statusHistory: sortedHistory
            }
        });
    } catch (e) {
        return res.status(500).json({ message: e.message || e, success: false, error: true });
    }
};

export const updateTracking = async (req, res) => {
    try {
        const { id } = req.params;
        const { partner, trackingNumber, url } = req.body;
        const order = await OrderV2Model.findById(id)
        if(!order) return res.status(404).json({ message: 'Order not found', success:false, error:true })
        
        const updatedTracking = {
            partner: partner || order.tracking?.partner || '',
            trackingNumber: trackingNumber || order.tracking?.trackingNumber || '',
            url: url || order.tracking?.url || '',
            updatedAt: new Date()
        };
        
        order.tracking = updatedTracking;
        await order.save();
        
        // Send tracking update email
        try {
            const emailResult = await EmailService.sendTrackingUpdateEmail(id, updatedTracking, order);
            if (!emailResult.success) {
                // Log error for debugging (remove in production)
                // console.error('Tracking update email failed:', emailResult.error);
            }
        } catch (emailError) {
            // Log error for debugging (remove in production)
            // console.error('Tracking update email error:', emailError);
            // Continue even if email fails
        }

        // Send push notification for tracking update
        try {
            const { default: PushNotificationService } = await import('../utils/pushNotificationService.js');
            const pushResult = await PushNotificationService.sendTrackingUpdate(
                order.user, 
                order.orderNumber, 
                updatedTracking, 
                order
            );
            if (!pushResult.success) {
                // Log error for debugging (remove in production)
                // console.error('Tracking update push notification failed:', pushResult.error);
            }
        } catch (pushError) {
            // Log error for debugging (remove in production)
            // console.error('Tracking update push notification error:', pushError);
            // Continue even if push notification fails
        }
        
        return res.json({ message: 'Tracking updated', success:true, error:false, data: order })
    } catch (e) {
        return res.status(500).json({ message: e.message || e, success:false, error:true })
    }
}

export const createPaymentSession = async (req, res) => {
    try {
        const userId = req.userId;
        const { orderItems, shippingAddress, couponCode, deliveryCharge = 0, finalTotal } = req.body;

        if (!Array.isArray(orderItems) || orderItems.length === 0) {
            return res.status(400).json({ message: "Order must include items", success: false, error: true });
        }

        const required = ["fullName", "phone", "address", "city", "pincode", "state"];
        for (const k of required) {
            if (!shippingAddress?.[k]) {
                return res.status(400).json({ message: `${k} is required in shipping address`, success: false, error: true });
            }
        }

        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found", success: false, error: true });
        }

        // Batch fetch all products to avoid N+1 queries
        const productIds = orderItems.map(item => item.product || item.productId || item._id);
        
        // Validate all product IDs
        for (const productId of productIds) {
            if (!isValidObjectId(productId)) {
                return res.status(400).json({ 
                    message: `Invalid product ID format: ${productId}`, 
                    success: false, 
                    error: true 
                });
            }
        }
        
        const products = await ProductModel.find({ _id: { $in: productIds } });
        const productMap = new Map(products.map(p => [p._id.toString(), p]));
        
        // Validate products and calculate totals
        const normalizedItems = [];
        let subtotal = 0;
        for (const item of orderItems) {
            const productId = item.product || item.productId || item._id;
            const quantity = Number(item.quantity ?? item.qty ?? 1);
            
            const product = productMap.get(productId.toString());
            if (!product) {
                return res.status(400).json({ message: `Product ${productId} not found`, success: false, error: true });
            }
            // Validate stock based on product type
            if (product.hasVariants && item.selectedVariant) {
                // For products with variants, check variant stock
                const variant = product.variants.find(v => v.name === item.selectedVariant.name);
                if (!variant) {
                    return res.status(400).json({ 
                        message: `Variant ${item.selectedVariant.name} not found for ${product.name}`, 
                        success: false, 
                        error: true 
                    });
                }
                if (!variant.isActive) {
                    return res.status(400).json({ 
                        message: `Variant ${item.selectedVariant.name} is not available for ${product.name}`, 
                        success: false, 
                        error: true 
                    });
                }
                if (variant.stock < quantity) {
                    return res.status(400).json({ 
                        message: `Insufficient stock for ${product.name} - ${item.selectedVariant.name}`, 
                        success: false, 
                        error: true 
                    });
                }
            } else if (product.requiresSize && item.selectedSize) {
                // For products with size, check size stock
                const sizeStock = product.sizeStock?.find(s => s.size === item.selectedSize);
                if (!sizeStock || sizeStock.stock < quantity) {
                    return res.status(400).json({ 
                        message: `Insufficient stock for ${product.name} - Size ${item.selectedSize}`, 
                        success: false, 
                        error: true 
                    });
                }
            } else {
                // For products without size or variants, check regular stock
                if (product.stock < quantity) {
                    return res.status(400).json({ 
                        message: `Insufficient stock for ${product.name}`, 
                        success: false, 
                        error: true 
                    });
                }
            }

            // Calculate unit price based on whether variant is selected
            let unitPrice;
            if (item.selectedVariant) {
                unitPrice = calcPrice(item.selectedVariant.price, item.selectedVariant.discount);
            } else {
                unitPrice = calcPrice(product.price, product.discount);
            }
            
            subtotal += unitPrice * quantity;
            normalizedItems.push({
                product: product._id,
                name: product.name,
                image: product.image?.[0] || "",
                price: unitPrice,
                quantity: quantity,
                selectedSize: item.selectedSize,
                selectedVariant: item.selectedVariant,
                podData: item.podData,
            });
        }

        let totalPrice;
        let couponData = {};

        // Use finalTotal from frontend if provided (to avoid double calculation)
        if (finalTotal !== undefined && finalTotal !== null) {
            totalPrice = Number(finalTotal);
            console.log('Using frontend finalTotal:', {
                frontendFinalTotal: finalTotal,
                totalPrice,
                razorpayAmount: Math.round(totalPrice * 100)
            });
        } else {
            // Fallback to backend calculation if frontend total not provided
            totalPrice = subtotal + Number(deliveryCharge);
            
            // Apply coupon if provided
            if (couponCode) {
                try {
                    // Use already fetched products for coupon calculation
                    const cartItemsForCoupon = orderItems.map((item) => {
                        const product = productMap.get((item.product || item.productId || item._id).toString());
                        return {
                            productId: { 
                                _id: product._id,
                                price: product.price,
                                discount: product.discount,
                                category: product.category
                            },
                            quantity: item.quantity,
                            selectedSize: item.selectedSize,
                            podData: item.podData
                        };
                    });
                    
                    const couponResult = await applyCouponToOrder(couponCode, userId, subtotal, cartItemsForCoupon);
                    totalPrice = couponResult.finalTotal + Number(deliveryCharge);
                    couponData = {
                        code: couponResult.coupon.code,
                        discountAmount: couponResult.discountAmount,
                        discountType: couponResult.coupon.discountType,
                        discountValue: couponResult.coupon.discountValue
                    };
                    
                    // Debug logging
                    console.log('Backend Coupon Debug (createPaymentSession):', {
                        couponCode,
                        subtotal,
                        deliveryCharge,
                        discountAmount: couponResult.discountAmount,
                        finalTotal: couponResult.finalTotal,
                        totalPrice,
                        razorpayAmount: Math.round(totalPrice * 100)
                    });
                } catch (couponError) {
                    return res.status(400).json({ 
                        message: couponError.message, 
                        success: false, 
                        error: true 
                    });
                }
            }
        }

        // Create Razorpay order
        const options = {
            amount: Math.round(totalPrice * 100), // Amount in paise
            currency: getCurrencyCode(),
            receipt: `order_${Date.now()}`,
            payment_capture: 1, // Auto-capture payment
            notes: {
                orderNumber: await generateOrderNumber(),
                userId: userId,
                orderData: JSON.stringify({
                    orderItems: normalizedItems,
                    shippingAddress,
                    subtotal,
                    deliveryCharge: Number(deliveryCharge),
                    totalPrice,
                    coupon: couponData,
                    frontendFinalTotal: finalTotal
                })
            }
        };

        const razorpayOrder = await razorpay.orders.create(options);

        return res.status(200).json({
            message: "Payment session created",
            success: true,
            error: false,
            data: razorpayOrder
        });

    } catch (e) {
        return res.status(500).json({ message: e.message || e, success: false, error: true });
    }
};

export const webhookRazorpayV2 = async (req, res) => {
    try {
        const event = req.body;
        const signature = req.headers['x-razorpay-signature'];
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

        // Verify webhook signature
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(JSON.stringify(event))
            .digest('hex');

        if (signature !== expectedSignature) {
            return res.status(400).json({ error: 'Invalid signature' });
        }

        // Handle the event
        if (event.event === 'payment.captured') {
            const payment = event.payload.payment.entity;
            const orderId = payment.order_id;
            
            try {
                // Get the Razorpay order to extract metadata
                const razorpayOrder = await razorpay.orders.fetch(orderId);
                const userId = razorpayOrder.notes.userId;
                const orderData = JSON.parse(razorpayOrder.notes.orderData);
                
                // Create the order
                const order = await OrderV2Model.create({
                    orderNumber: razorpayOrder.notes.orderNumber,
                    user: userId,
                    orderItems: orderData.orderItems,
                    statusHistory: [{
                        status: 'Pending',
                        updatedAt: new Date(),
                        updatedBy: userId
                    }],
                    shippingAddress: orderData.shippingAddress,
                    paymentMethod: 'RAZORPAY',
                    paymentStatus: 'Paid',
                    subtotal: orderData.subtotal,
                    deliveryCharge: orderData.deliveryCharge || 0,
                    totalPrice: orderData.frontendFinalTotal || orderData.totalPrice,
                    coupon: orderData.coupon
                });

                // Decrement stock
                for (const item of orderData.orderItems) {
                    await ProductModel.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
                }

                // Clear cart
                await CartProductModel.deleteMany({ userId: userId });
                await UserModel.findByIdAndUpdate(userId, { shopping_cart: [] });

                // Send order confirmation email (non-blocking)
                EmailService.sendOrderConfirmationEmail(order).catch(emailError => {
                    // Log error for debugging (remove in production)
                    // console.error('Order confirmation email error:', emailError);
                });

                // Send push notification for order confirmation (non-blocking)
                import('../utils/pushNotificationService.js').then(({ default: PushNotificationService }) => {
                    PushNotificationService.sendOrderStatusUpdate(
                        order.user, 
                        order.orderNumber, 
                        'Pending', 
                        order
                    ).catch(pushError => {
                        // Log error for debugging (remove in production)
                        // console.error('Order confirmation push notification error:', pushError);
                    });
                });

                } catch (error) {
                }
        }

        // Return a response to acknowledge receipt of the event
        res.json({ received: true });
    } catch (error) {
        res.status(500).json({ error: 'Webhook processing failed' });
    }
};

export const cancelMyOrder = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const order = await OrderV2Model.findOne({ _id: id, user: userId });
        if (!order) return res.status(404).json({ message: "Order not found", success: false, error: true });
        if (["Shipped", "Out for Delivery", "Delivered"].includes(order.orderStatus)) {
            return res.status(400).json({ message: "Cannot cancel at this stage", success: false, error: true });
        }
        const updated = await OrderV2Model.findByIdAndUpdate(
            order._id,
            { $set: { orderStatus: 'Cancelled' } },
            { new: true, runValidators: false }
        );

        // Send push notification for order cancellation (non-blocking)
        import('../utils/pushNotificationService.js').then(({ default: PushNotificationService }) => {
            PushNotificationService.sendOrderStatusUpdate(
                order.user, 
                order.orderNumber, 
                'Cancelled', 
                updated
            ).catch(pushError => {
                // Log error for debugging (remove in production)
                // console.error('Order cancellation push notification error:', pushError);
            });
        });

        return res.json({ message: "Order cancelled", success: true, error: false, data: updated });
    } catch (e) {
        return res.status(500).json({ message: e.message || e, success: false, error: true });
    }
};

export const updateOrderAddress = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { shippingAddress, addressId } = req.body;

        const order = await OrderV2Model.findOne({ _id: id, user: userId });
        if (!order) return res.status(404).json({ message: "Order not found", success: false, error: true });

        if (["Shipped", "Out for Delivery", "Delivered", "Cancelled"].includes(order.orderStatus)) {
            return res.status(400).json({ message: "Address can't be edited at this stage", success: false, error: true });
        }

        let newAddress = shippingAddress;
        if (!newAddress && addressId) {
            const addr = await AddressModel.findById(addressId);
            if (!addr) return res.status(400).json({ message: 'Address not found', success: false, error: true })
            newAddress = {
                fullName: addr.fullName || 'User',
                phone: String(addr.mobile || ''),
                address: addr.address_line,
                city: addr.city,
                pincode: addr.pincode,
                state: addr.state
            }
        }

        if (!newAddress) return res.status(400).json({ message: 'shippingAddress or addressId required', success: false, error: true })

        order.shippingAddress = newAddress;
        await order.save();
        return res.json({ message: 'Address updated', success: true, error: false, data: order })
    } catch (e) {
        return res.status(500).json({ message: e.message || e, success: false, error: true })
    }
}

export const cleanupOrderNumbers = async (req, res) => {
    try {
        await cleanupNullOrderNumbers();
        return res.json({ message: "Order numbers cleaned up successfully", success: true, error: false });
    } catch (error) {
        return res.status(500).json({ message: error.message || error, success: false, error: true });
    }
};