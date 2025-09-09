import CouponModel from "../models/coupon.model.js";

// Create a new coupon (admin only)
export const createCoupon = async (req, res) => {
    try {
        const { 
            code, 
            discountType, 
            discountValue, 
            minOrderValue, 
            expiryDate, 
            usageLimit, 
            useLimitPerUser,
            categoryRestrictions,
            userRestrictions,
            isUnlisted
        } = req.body;

        // Validate required fields
        if (!code || !discountType || !discountValue || !expiryDate) {
            return res.status(400).json({
                message: "Missing required fields",
                error: true,
                success: false
            });
        }

        // Check if coupon code already exists
        const existingCoupon = await CouponModel.findOne({ code: code.toUpperCase() });
        if (existingCoupon) {
            return res.status(400).json({
                message: "Coupon code already exists",
                error: true,
                success: false
            });
        }

        // Validate expiry date
        if (new Date(expiryDate) <= new Date()) {
            return res.status(400).json({
                message: "Expiry date must be in the future",
                error: true,
                success: false
            });
        }

        // Validate discount value
        if (discountType === "percentage" && (discountValue <= 0 || discountValue > 100)) {
            return res.status(400).json({
                message: "Percentage discount must be between 1 and 100",
                error: true,
                success: false
            });
        }

        const couponData = {
            code: code.toUpperCase(),
            discountType,
            discountValue,
            minOrderValue: minOrderValue || 0,
            expiryDate,
            usageLimit: usageLimit || null,
            useLimitPerUser: useLimitPerUser || 1,
            isUnlisted: isUnlisted || false
        };

        // Add restrictions if provided
        if (categoryRestrictions) {
            couponData.categoryRestrictions = categoryRestrictions;
        }
        if (userRestrictions) {
            couponData.userRestrictions = userRestrictions;
        }

        const coupon = await CouponModel.create(couponData);

        return res.status(201).json({
            message: "Coupon created successfully",
            error: false,
            success: true,
            data: coupon
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

// Get all coupons for user (including used ones)
export const getAllCouponsForUser = async (req, res) => {
    try {
        const { orderValue, cartItems } = req.query;
        const userId = req.userId || req.user?._id;

        if (!orderValue || orderValue <= 0) {
            return res.status(400).json({
                message: "Valid order value is required",
                error: true,
                success: false
            });
        }

        // Parse cart items if provided
        let parsedCartItems = [];
        if (cartItems) {
            try {
                parsedCartItems = JSON.parse(cartItems);
            } catch (error) {
                console.error('Error parsing cart items:', error);
            }
        }

        // Get all active coupons that haven't expired and are NOT unlisted
        const coupons = await CouponModel.find({
            isActive: true,
            expiryDate: { $gt: new Date() },
            isUnlisted: false // Filter out unlisted coupons from public display
        });

        // Calculate potential savings for each coupon and mark if user can use it
        const couponsWithDetails = coupons.map(coupon => {
            // Use the new method that calculates discount only for eligible items
            const discountAmount = parsedCartItems.length > 0 
                ? coupon.calculateDiscountForEligibleItems(parsedCartItems)
                : coupon.calculateDiscount(Number(orderValue));
            
            const finalPrice = Math.max(0, Number(orderValue) - discountAmount);
            const canUse = userId ? coupon.canUserUse(userId) : true;
            const meetsMinOrder = orderValue >= coupon.minOrderValue;
            
            // Check category and product restrictions if cart items are provided
            let meetsRestrictions = true;
            let restrictionReason = null;
            
            if (parsedCartItems.length > 0) {
                // Extract product IDs and category IDs from cart items
                const categoryIds = parsedCartItems.flatMap(item => 
                    item.productId?.category || []
                );
                
                // Check if coupon is valid for these categories
                meetsRestrictions = coupon.isValidForCategories(categoryIds);
                
                if (!meetsRestrictions) {
                    if (coupon.categoryRestrictions?.enabled) {
                        restrictionReason = `This coupon is only valid for ${coupon.categoryRestrictions.restrictionType === 'include' ? 'selected' : 'non-selected'} categories`;
                    }
                }
            }
            
            const canUseCoupon = canUse && meetsMinOrder && meetsRestrictions;
            
            // Get eligible items for this coupon
            const eligibleItems = parsedCartItems.length > 0 
                ? coupon.getEligibleItems(parsedCartItems)
                : [];

            return {
                _id: coupon._id,
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                minOrderValue: coupon.minOrderValue,
                expiryDate: coupon.expiryDate,
                potentialSavings: discountAmount,
                finalPrice: finalPrice,
                usedBy: coupon.usedBy,
                canUse: canUseCoupon,
                meetsMinOrder: meetsMinOrder,
                meetsRestrictions: meetsRestrictions,
                eligibleItems: eligibleItems.map(item => item.productId?._id || item.productId),
                reason: !meetsMinOrder ? `Minimum order value of ₹${coupon.minOrderValue} required` : 
                        !canUse ? 'You have already used this coupon' : 
                        !meetsRestrictions ? restrictionReason : null
            };
        });

        // Sort by potential savings (highest first)
        couponsWithDetails.sort((a, b) => b.potentialSavings - a.potentialSavings);

        return res.json({
            message: "All coupons fetched successfully",
            error: false,
            success: true,
            data: couponsWithDetails
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

// Get eligible coupons for user
export const getEligibleCoupons = async (req, res) => {
    try {
        const { orderValue } = req.query;
        const userId = req.userId || req.user?._id; // Handle both auth middleware and direct access

        if (!orderValue || orderValue <= 0) {
            return res.status(400).json({
                message: "Valid order value is required",
                error: true,
                success: false
            });
        }

        // Get all active coupons that haven't expired and are NOT unlisted
        const coupons = await CouponModel.find({
            isActive: true,
            expiryDate: { $gt: new Date() },
            isUnlisted: false // Filter out unlisted coupons from public display
        });

        // Filter coupons that user can use and meet minimum order value
        const eligibleCoupons = coupons.filter(coupon => {
            const meetsMinOrder = orderValue >= coupon.minOrderValue;
            
            // If user is not authenticated, only check minimum order value
            if (!userId) {
                return meetsMinOrder;
            }
            
            const canUse = coupon.canUserUse(userId);
            return canUse && meetsMinOrder;
        });

        // Calculate potential savings for each coupon
        const couponsWithSavings = eligibleCoupons.map(coupon => {
            const discountAmount = coupon.calculateDiscount(Number(orderValue));
            const finalPrice = Math.max(0, Number(orderValue) - discountAmount);
            
            return {
                _id: coupon._id,
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                minOrderValue: coupon.minOrderValue,
                expiryDate: coupon.expiryDate,
                potentialSavings: discountAmount,
                finalPrice: finalPrice,
                usedBy: coupon.usedBy // Include usedBy information for frontend filtering
            };
        });

        // Sort by potential savings (highest first)
        couponsWithSavings.sort((a, b) => b.potentialSavings - a.potentialSavings);

        return res.json({
            message: "Eligible coupons fetched successfully",
            error: false,
            success: true,
            data: couponsWithSavings
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

// Get all coupons (admin only)
export const getAllCoupons = async (req, res) => {
    try {
        const { page = 1, limit = 20, isActive } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const query = {};
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        const [coupons, total] = await Promise.all([
            CouponModel.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .populate('usedBy.userId', 'name email'),
            CouponModel.countDocuments(query)
        ]);

        return res.json({
            message: "Coupons fetched successfully",
            error: false,
            success: true,
            data: coupons,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit))
            }
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

// Validate coupon for user
export const validateCoupon = async (req, res) => {
    try {
        const { code } = req.params;
        const { orderValue, categoryIds } = req.body;
        const userId = req.userId;

        if (!code || !orderValue) {
            return res.status(400).json({
                message: "Coupon code and order value are required",
                error: true,
                success: false
            });
        }

        const coupon = await CouponModel.findOne({ code: code.toUpperCase() });
        if (!coupon) {
            return res.status(404).json({
                message: "Coupon not found",
                error: true,
                success: false
            });
        }

        // Check if coupon is valid
        if (!coupon.isValid()) {
            return res.status(400).json({
                message: "Coupon is expired or inactive",
                error: true,
                success: false
            });
        }

        // Check if user can use this coupon
        if (!coupon.canUserUse(userId)) {
            return res.status(400).json({
                message: "You cannot use this coupon",
                error: true,
                success: false
            });
        }

        // Check minimum order value
        if (orderValue < coupon.minOrderValue) {
            return res.status(400).json({
                message: `Minimum order value of ${coupon.minOrderValue} required`,
                error: true,
                success: false
            });
        }

        // Check category restrictions
        if (categoryIds) {
            if (!coupon.isValidForCategories(categoryIds)) {
                return res.status(400).json({
                    message: "This coupon cannot be used with the selected categories",
                    error: true,
                    success: false
                });
            }
        }

        // Calculate discount - use cart items if available for partial application
        let discountAmount;
        if (req.body.cartItems && Array.isArray(req.body.cartItems)) {
            discountAmount = coupon.calculateDiscountForEligibleItems(req.body.cartItems);
        } else {
            discountAmount = coupon.calculateDiscount(orderValue);
        }
        const finalTotal = orderValue - discountAmount;

        return res.json({
            message: "Coupon applied successfully",
            error: false,
            success: true,
            data: {
                coupon: {
                    code: coupon.code,
                    discountType: coupon.discountType,
                    discountValue: coupon.discountValue,
                    minOrderValue: coupon.minOrderValue
                },
                orderValue,
                discountAmount,
                finalTotal
            }
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

// Update coupon (admin only)
export const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const coupon = await CouponModel.findById(id);
        if (!coupon) {
            return res.status(404).json({
                message: "Coupon not found",
                error: true,
                success: false
            });
        }

        // If updating code, check for uniqueness
        if (updateData.code && updateData.code !== coupon.code) {
            const existingCoupon = await CouponModel.findOne({ 
                code: updateData.code.toUpperCase(),
                _id: { $ne: id }
            });
            if (existingCoupon) {
                return res.status(400).json({
                    message: "Coupon code already exists",
                    error: true,
                    success: false
                });
            }
            updateData.code = updateData.code.toUpperCase();
        }

        // Validate expiry date if updating
        if (updateData.expiryDate && new Date(updateData.expiryDate) <= new Date()) {
            return res.status(400).json({
                message: "Expiry date must be in the future",
                error: true,
                success: false
            });
        }

        // Validate category restrictions if updating
        if (updateData.categoryRestrictions && updateData.categoryRestrictions.enabled) {
            if (!updateData.categoryRestrictions.categories || updateData.categoryRestrictions.categories.length === 0) {
                return res.status(400).json({
                    message: "Categories must be selected when category restrictions are enabled",
                    error: true,
                    success: false
                });
            }
        }



        const updatedCoupon = await CouponModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        return res.json({
            message: "Coupon updated successfully",
            error: false,
            success: true,
            data: updatedCoupon
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

// Delete coupon (admin only)
export const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;

        const coupon = await CouponModel.findByIdAndDelete(id);
        if (!coupon) {
            return res.status(404).json({
                message: "Coupon not found",
                error: true,
                success: false
            });
        }

        return res.json({
            message: "Coupon deleted successfully",
            error: false,
            success: true
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

// Apply coupon to order (internal use)
export const applyCouponToOrder = async (couponCode, userId, orderValue, cartItems = null) => {
    try {
        const coupon = await CouponModel.findOne({ code: couponCode.toUpperCase() });
        if (!coupon) {
            throw new Error("Coupon not found");
        }

        if (!coupon.isValid()) {
            throw new Error("Coupon is expired or inactive");
        }

        if (!coupon.canUserUse(userId)) {
            // Check specific reasons why user cannot use
            if (coupon.usageLimit && coupon.usedBy.length >= coupon.usageLimit) {
                throw new Error("Coupon usage limit has been reached");
            }
            
            const userUsed = coupon.usedBy.some(usage => usage.userId.toString() === userId.toString());
            if (userUsed) {
                throw new Error("You have already used this coupon");
            }
            
            throw new Error("You cannot use this coupon");
        }

        // Calculate discount - use cart items if available for partial application
        let discountAmount;
        if (cartItems && cartItems.length > 0) {
            discountAmount = coupon.calculateDiscountForEligibleItems(cartItems);
        } else {
            discountAmount = coupon.calculateDiscount(orderValue);
        }

        const finalTotal = orderValue - discountAmount;

        // Mark coupon as used by this user
        coupon.usedBy.push({ userId });
        await coupon.save();

        return {
            coupon: {
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue
            },
            discountAmount,
            finalTotal
        };

    } catch (error) {
        throw error;
    }
};
