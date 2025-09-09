import mongoose from "mongoose";

// Stock movement schema for tracking all inventory changes
const stockMovementSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['purchase', 'sale', 'adjustment', 'return', 'damage', 'transfer', 'initial'],
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    previousStock: {
        type: Number,
        required: true
    },
    newStock: {
        type: Number,
        required: true
    },
    reference: {
        type: String, // Order ID, Purchase ID, etc.
        default: ''
    },
    notes: {
        type: String,
        default: ''
    },
    performedBy: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    cost: {
        type: Number,
        default: 0
    },
    location: {
        type: String,
        default: 'main'
    }
}, {
    timestamps: true
});

// Inventory alert schema
const inventoryAlertSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['low_stock', 'out_of_stock', 'overstock', 'expiry_warning'],
        required: true
    },
    threshold: {
        type: Number,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastTriggered: {
        type: Date,
        default: null
    },
    notificationEmail: {
        type: String,
        default: ''
    }
}, { _id: false });

// Supplier schema
const supplierSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    contactPerson: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    address: {
        type: String,
        trim: true
    },
    leadTime: {
        type: Number, // in days
        default: 7
    },
    minimumOrderQuantity: {
        type: Number,
        default: 1
    },
    cost: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { _id: false });

// Location schema for multi-location inventory
const locationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    address: {
        type: String,
        trim: true
    },
    stock: {
        type: Number,
        default: 0,
        min: 0
    },
    reservedStock: {
        type: Number,
        default: 0,
        min: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { _id: false });

// Main inventory schema
const inventorySchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.ObjectId,
        ref: 'Product',
        required: true
    },
    
    // Basic stock information
    currentStock: {
        type: Number,
        default: 0,
        min: 0
    },
    reservedStock: {
        type: Number,
        default: 0,
        min: 0
    },
    availableStock: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Size-based inventory (for products with sizes)
    sizeInventory: [{
        size: {
            type: String,
            required: true
        },
        currentStock: {
            type: Number,
            default: 0,
            min: 0
        },
        reservedStock: {
            type: Number,
            default: 0,
            min: 0
        },
        availableStock: {
            type: Number,
            default: 0,
            min: 0
        }
    }],
    
    // Variant-based inventory (for products with variants)
    variantInventory: [{
        variantName: {
            type: String,
            required: true
        },
        currentStock: {
            type: Number,
            default: 0,
            min: 0
        },
        reservedStock: {
            type: Number,
            default: 0,
            min: 0
        },
        availableStock: {
            type: Number,
            default: 0,
            min: 0
        }
    }],
    
    // Multi-location inventory
    locations: {
        type: [locationSchema],
        default: []
    },
    
    // Cost and pricing
    averageCost: {
        type: Number,
        default: 0
    },
    lastPurchaseCost: {
        type: Number,
        default: 0
    },
    totalValue: {
        type: Number,
        default: 0
    },
    
    // Stock thresholds and alerts
    lowStockThreshold: {
        type: Number,
        default: 10
    },
    reorderPoint: {
        type: Number,
        default: 5
    },
    reorderQuantity: {
        type: Number,
        default: 50
    },
    alerts: {
        type: [inventoryAlertSchema],
        default: []
    },
    
    // Supplier information
    suppliers: {
        type: [supplierSchema],
        default: []
    },
    primarySupplier: {
        type: String,
        default: ''
    },
    
    // Tracking information
    sku: {
        type: String,
        trim: true,
        sparse: true
    },
    barcode: {
        type: String,
        trim: true
    },
    expiryDate: {
        type: Date,
        default: null
    },
    batchNumber: {
        type: String,
        trim: true
    },
    
    // Stock movement history
    stockMovements: {
        type: [stockMovementSchema],
        default: []
    },
    
    // Analytics and metrics
    totalPurchased: {
        type: Number,
        default: 0
    },
    totalSold: {
        type: Number,
        default: 0
    },
    totalReturned: {
        type: Number,
        default: 0
    },
    totalDamaged: {
        type: Number,
        default: 0
    },
    
    // Status and flags
    isActive: {
        type: Boolean,
        default: true
    },
    isTracked: {
        type: Boolean,
        default: true
    },
    lastStockUpdate: {
        type: Date,
        default: Date.now
    },
    
    // Auto-reorder settings
    autoReorder: {
        enabled: {
            type: Boolean,
            default: false
        },
        threshold: {
            type: Number,
            default: 5
        },
        quantity: {
            type: Number,
            default: 50
        }
    }
}, {
    timestamps: true
});

// Indexes for better performance
inventorySchema.index({ product: 1 });
inventorySchema.index({ sku: 1 }, { unique: true, sparse: true });
inventorySchema.index({ barcode: 1 });
inventorySchema.index({ currentStock: 1 });
inventorySchema.index({ availableStock: 1 });
inventorySchema.index({ isActive: 1 });
inventorySchema.index({ expiryDate: 1 });
inventorySchema.index({ "stockMovements.createdAt": -1 });

// Virtual for total stock across all locations
inventorySchema.virtual('totalLocationStock').get(function() {
    if (!this.locations || this.locations.length === 0) {
        return this.currentStock || 0;
    }
    return this.locations.reduce((total, location) => total + (location.stock || 0), 0);
});

// Virtual for total reserved stock across all locations
inventorySchema.virtual('totalLocationReservedStock').get(function() {
    if (!this.locations || this.locations.length === 0) {
        return this.reservedStock || 0;
    }
    return this.locations.reduce((total, location) => total + (location.reservedStock || 0), 0);
});

// Method to update available stock
inventorySchema.methods.updateAvailableStock = function() {
    this.availableStock = Math.max(0, this.currentStock - this.reservedStock);
    return this.availableStock;
};

// Method to add stock movement
inventorySchema.methods.addStockMovement = function(movement) {
    this.stockMovements.push(movement);
    this.lastStockUpdate = new Date();
    return this.save();
};

// Method to check if stock is low
inventorySchema.methods.isLowStock = function() {
    return this.availableStock <= this.lowStockThreshold;
};

// Method to check if reorder is needed
inventorySchema.methods.needsReorder = function() {
    return this.availableStock <= this.reorderPoint;
};

// Method to get stock for specific size
inventorySchema.methods.getSizeStock = function(size) {
    const sizeInventory = this.sizeInventory.find(s => s.size === size);
    return sizeInventory ? sizeInventory.availableStock : 0;
};

// Method to get stock for specific variant
inventorySchema.methods.getVariantStock = function(variantName) {
    const variantInventory = this.variantInventory.find(v => v.variantName === variantName);
    return variantInventory ? variantInventory.availableStock : 0;
};

// Method to reserve stock
inventorySchema.methods.reserveStock = function(quantity, size = null, variantName = null) {
    if (size) {
        const sizeInventory = this.sizeInventory.find(s => s.size === size);
        if (sizeInventory && sizeInventory.availableStock >= quantity) {
            sizeInventory.reservedStock += quantity;
            sizeInventory.availableStock = Math.max(0, sizeInventory.currentStock - sizeInventory.reservedStock);
            this.reservedStock += quantity;
            this.availableStock = Math.max(0, this.currentStock - this.reservedStock);
            return true;
        }
    } else if (variantName) {
        const variantInventory = this.variantInventory.find(v => v.variantName === variantName);
        if (variantInventory && variantInventory.availableStock >= quantity) {
            variantInventory.reservedStock += quantity;
            variantInventory.availableStock = Math.max(0, variantInventory.currentStock - variantInventory.reservedStock);
            this.reservedStock += quantity;
            this.availableStock = Math.max(0, this.currentStock - this.reservedStock);
            return true;
        }
    } else {
        if (this.availableStock >= quantity) {
            this.reservedStock += quantity;
            this.availableStock = Math.max(0, this.currentStock - this.reservedStock);
            return true;
        }
    }
    return false;
};

// Method to release reserved stock
inventorySchema.methods.releaseReservedStock = function(quantity, size = null, variantName = null) {
    if (size) {
        const sizeInventory = this.sizeInventory.find(s => s.size === size);
        if (sizeInventory) {
            sizeInventory.reservedStock = Math.max(0, sizeInventory.reservedStock - quantity);
            sizeInventory.availableStock = Math.max(0, sizeInventory.currentStock - sizeInventory.reservedStock);
            this.reservedStock = Math.max(0, this.reservedStock - quantity);
            this.availableStock = Math.max(0, this.currentStock - this.reservedStock);
        }
    } else if (variantName) {
        const variantInventory = this.variantInventory.find(v => v.variantName === variantName);
        if (variantInventory) {
            variantInventory.reservedStock = Math.max(0, variantInventory.reservedStock - quantity);
            variantInventory.availableStock = Math.max(0, variantInventory.currentStock - variantInventory.reservedStock);
            this.reservedStock = Math.max(0, this.reservedStock - quantity);
            this.availableStock = Math.max(0, this.currentStock - this.reservedStock);
        }
    } else {
        this.reservedStock = Math.max(0, this.reservedStock - quantity);
        this.availableStock = Math.max(0, this.currentStock - this.reservedStock);
    }
};

// Pre-save middleware to update available stock
inventorySchema.pre('save', function(next) {
    this.updateAvailableStock();
    next();
});

const InventoryModel = mongoose.model('Inventory', inventorySchema);

export default InventoryModel;
