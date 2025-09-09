import mongoose from "mongoose";

const sizeSchema = new mongoose.Schema({
    size: {
        type: String,
        required: true,
        trim: true
    },
    stock: {
        type: Number,
        default: 0,
        min: 0
    }
}, { _id: false });

// Product variant schema
const variantSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    discount: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    stock: {
        type: Number,
        default: 0,
        min: 0
    },
    image: {
        type: String,
        default: ""
    },
    sku: {
        type: String,
        trim: true,
        default: ""
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { _id: false });

// POD (Print on Demand) field schema
const podFieldSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['text', 'textarea', 'file', 'date', 'number', 'email', 'phone', 'select', 'radio', 'checkbox'],
        default: 'text'
    },
    label: {
        type: String,
        required: true,
        trim: true
    },
    placeholder: {
        type: String,
        default: ''
    },
    required: {
        type: Boolean,
        default: true
    },
    validation: {
        minLength: { type: Number, default: 0 },
        maxLength: { type: Number, default: 1000 },
        pattern: { type: String, default: '' }
    },
    fileTypes: {
        type: [String],
        default: ['image/jpeg', 'image/png', 'image/gif']
    },
    maxFileSize: {
        type: Number,
        default: 5 * 1024 * 1024 // 5MB default
    },
    options: {
        type: [String],
        default: []
    }
}, { _id: false });

const productSchema = new mongoose.Schema({
    name : {
        type : String,
    },
    image : {
        type : Array,
        default : []
    },
    category : [
        {
            type : mongoose.Schema.ObjectId,
            ref : 'Category'
        }
    ],
    subCategory : [
        {
            type : mongoose.Schema.ObjectId,
            ref : 'SubCategory'
        }
    ],
    unit : {
        type : String,
        default : ""
    },
    stock : {
        type : Number,
        default : null
    },
    // New sizes field for size management
    sizes : {
        type: [sizeSchema],
        default: []
    },
    // Flag to indicate if product requires size selection
    requiresSize : {
        type: Boolean,
        default: false
    },
    // Product variants support
    hasVariants : {
        type: Boolean,
        default: false
    },
    variants : {
        type: [variantSchema],
        default: []
    },
    // POD (Print on Demand) functionality
    isPOD : {
        type: Boolean,
        default: false
    },
    podFields : {
        type: [podFieldSchema],
        default: []
    },
    price : {
        type : Number,
        default : null
    },
    discount : {
        type : Number,
        default : null
    },
    description : {
        type : String,
        default : ""
    },
    more_details : {
        type : Object,
        default : {}
    },
    publish : {
        type : Boolean,
        default : true
    },
    averageRating : {
        type : Number,
        default : 0
    },

},{
    timestamps : true
})

//create a text index
productSchema.index({
    name  : "text",
    description : 'text'
},{
    name : 10,
    description : 5
})

// Add indexes for better sorting performance
productSchema.index({ price: 1 })
productSchema.index({ price: -1 })
productSchema.index({ averageRating: -1 })
productSchema.index({ createdAt: -1 })
productSchema.index({ name: 1 })
productSchema.index({ name: -1 })

// Virtual for total stock across all sizes
productSchema.virtual('totalSizeStock').get(function() {
    if (!this.sizes || this.sizes.length === 0) {
        return this.stock || 0;
    }
    return this.sizes.reduce((total, size) => total + (size.stock || 0), 0);
});

// Virtual for total stock across all variants
productSchema.virtual('totalVariantStock').get(function() {
    if (!this.hasVariants || !this.variants || this.variants.length === 0) {
        return this.stock || 0;
    }
    return this.variants.reduce((total, variant) => total + (variant.stock || 0), 0);
});

// Method to check if product has any stock
productSchema.methods.hasStock = function() {
    if (this.hasVariants) {
        return this.variants.some(variant => variant.stock > 0 && variant.isActive);
    }
    if (this.requiresSize) {
        return this.sizes.some(size => size.stock > 0);
    }
    return (this.stock || 0) > 0;
};

// Method to get available sizes
productSchema.methods.getAvailableSizes = function() {
    if (!this.requiresSize || !this.sizes) {
        return [];
    }
    return this.sizes.filter(size => size.stock > 0);
};

// Method to get available variants
productSchema.methods.getAvailableVariants = function() {
    if (!this.hasVariants || !this.variants) {
        return [];
    }
    return this.variants.filter(variant => variant.stock > 0 && variant.isActive);
};

// Method to get variant by name
productSchema.methods.getVariantByName = function(variantName) {
    if (!this.hasVariants || !this.variants) {
        return null;
    }
    return this.variants.find(variant => variant.name === variantName && variant.isActive);
};

const ProductModel = mongoose.model('Product',productSchema)

export default ProductModel