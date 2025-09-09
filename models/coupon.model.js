import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, "Coupon code is required"],
        unique: true,
        uppercase: true,
        trim: true
    },
    discountType: {
        type: String,
        required: [true, "Discount type is required"],
        enum: ["percentage", "fixed"],
        default: "percentage"
    },
    discountValue: {
        type: Number,
        required: [true, "Discount value is required"],
        min: [0, "Discount value cannot be negative"]
    },
    minOrderValue: {
        type: Number,
        default: 0,
        min: [0, "Minimum order value cannot be negative"]
    },
    expiryDate: {
        type: Date,
        required: [true, "Expiry date is required"]
    },
    usageLimit: {
        type: Number,
        default: null,
        min: [1, "Usage limit must be at least 1"]
    },
    useLimitPerUser: {
        type: Number,
        default: 1,
        min: [1, "Use limit per user must be at least 1"]
    },
    // New fields for category restrictions
    categoryRestrictions: {
        enabled: {
            type: Boolean,
            default: false
        },
        categories: [{
            type: mongoose.Schema.ObjectId,
            ref: 'Category'
        }],
        restrictionType: {
            type: String,
            enum: ['include', 'exclude'],
            default: 'include'
        }
    },

    // New fields for user restrictions
    userRestrictions: {
        enabled: {
            type: Boolean,
            default: false
        },
        userTypes: [{
            type: String,
            enum: ['new', 'existing', 'vip', 'premium']
        }],
        minimumOrders: {
            type: Number,
            default: 0
        },
        minimumSpent: {
            type: Number,
            default: 0
        }
    },
    // New field for unlisted coupons
    isUnlisted: {
        type: Boolean,
        default: false
    },
    usedBy: [{
        userId: {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        },
        usedAt: {
            type: Date,
            default: Date.now
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes for better query performance
// Note: code index is automatically created due to unique: true in schema
couponSchema.index({ expiryDate: 1 });
couponSchema.index({ isActive: 1 });
couponSchema.index({ 'categoryRestrictions.categories': 1 });
couponSchema.index({ isUnlisted: 1 }); // Add index for unlisted coupons


// Method to check if coupon is valid
couponSchema.methods.isValid = function() {
    return this.isActive && new Date() < this.expiryDate;
};

// Method to check if user can use this coupon
couponSchema.methods.canUserUse = function(userId) {
    if (!this.isValid()) return false;
    
    // Check overall usage limit
    if (this.usageLimit && this.usedBy.length >= this.usageLimit) return false;
    
    // Check per-user usage limit
    const userUsageCount = this.usedBy.filter(usage => usage.userId.toString() === userId.toString()).length;
    if (userUsageCount >= this.useLimitPerUser) return false;
    
    return true;
};

// Method to check if coupon is valid for specific categories
couponSchema.methods.isValidForCategories = function(categoryIds) {
    // If no category restrictions, coupon is valid for all categories
    if (!this.categoryRestrictions.enabled) {
        return true;
    }

    // Check category restrictions
    if (this.categoryRestrictions.enabled && this.categoryRestrictions.categories.length > 0) {
        const hasValidCategory = categoryIds.some(catId => 
            this.categoryRestrictions.categories.some(couponCatId => 
                couponCatId.toString() === catId.toString()
            )
        );

        if (this.categoryRestrictions.restrictionType === 'include' && !hasValidCategory) {
            return false;
        }
        if (this.categoryRestrictions.restrictionType === 'exclude' && hasValidCategory) {
            return false;
        }
    }

    return true;
};

// Method to apply discount
couponSchema.methods.calculateDiscount = function(orderValue) {
    if (orderValue < this.minOrderValue) return 0;
    
    if (this.discountType === "percentage") {
        return Math.min((orderValue * this.discountValue) / 100, orderValue);
    } else {
        return Math.min(this.discountValue, orderValue);
    }
};

// Method to calculate discount only for eligible items
couponSchema.methods.calculateDiscountForEligibleItems = function(cartItems) {
    // If no category restrictions, apply to all items
    if (!this.categoryRestrictions.enabled) {
        const totalValue = cartItems.reduce((sum, item) => {
            const itemPrice = item.productId?.price || item.price || 0;
            const itemDiscount = item.productId?.discount || item.discount || 0;
            const discountedPrice = itemPrice - (itemPrice * itemDiscount / 100);
            return sum + (discountedPrice * item.quantity);
        }, 0);
        
        return this.calculateDiscount(totalValue);
    }

    // Calculate total value of eligible items only
    let eligibleItemsTotal = 0;
    let eligibleItemsCount = 0;

    cartItems.forEach(item => {
        const categoryIds = item.productId?.category || item.category || [];
        
        // Check if this item is eligible for the coupon based on category
        if (this.isValidForCategories(categoryIds)) {
            const itemPrice = item.productId?.price || item.price || 0;
            const itemDiscount = item.productId?.discount || item.discount || 0;
            const discountedPrice = itemPrice - (itemPrice * itemDiscount / 100);
            eligibleItemsTotal += (discountedPrice * item.quantity);
            eligibleItemsCount++;
        }
    });

    // If no eligible items, return 0
    if (eligibleItemsCount === 0) {
        return 0;
    }

    // Check minimum order value against eligible items total
    if (eligibleItemsTotal < this.minOrderValue) {
        return 0;
    }

    // Calculate discount on eligible items only
    if (this.discountType === "percentage") {
        return Math.min((eligibleItemsTotal * this.discountValue) / 100, eligibleItemsTotal);
    } else {
        return Math.min(this.discountValue, eligibleItemsTotal);
    }
};

// Method to get eligible items from cart
couponSchema.methods.getEligibleItems = function(cartItems) {
    if (!this.categoryRestrictions.enabled) {
        return cartItems; // All items are eligible
    }

    return cartItems.filter(item => {
        const categoryIds = item.productId?.category || item.category || [];
        return this.isValidForCategories(categoryIds);
    });
};

const CouponModel = mongoose.model('Coupon', couponSchema);

export default CouponModel;
