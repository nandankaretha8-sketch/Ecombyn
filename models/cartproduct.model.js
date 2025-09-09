import mongoose from "mongoose";

const cartProductSchema = new mongoose.Schema({
    productId : {
        type : mongoose.Schema.ObjectId,
        ref : 'Product'
    },
    quantity : {
        type : Number,
        default : 1
    },
    // New field for selected size
    selectedSize : {
        type: String,
        default: null
    },
    // New field for selected variant
    selectedVariant : {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    // POD (Print on Demand) data
    podData : {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: new Map()
    },
    userId : {
        type : mongoose.Schema.ObjectId,
        ref : "User"
    }
},{
    timestamps : true
})

// Add unique compound index to prevent duplicate products for same user and size/variant
cartProductSchema.index({ userId: 1, productId: 1, selectedSize: 1, selectedVariant: 1 }, { unique: true })

const CartProductModel = mongoose.model('CartProduct',cartProductSchema)

export default CartProductModel