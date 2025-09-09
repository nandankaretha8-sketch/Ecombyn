import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema({
    productId : {
        type : mongoose.Schema.ObjectId,
        ref : 'Product',
        required: true
    },
    userId : {
        type : mongoose.Schema.ObjectId,
        ref : "User",
        required: true
    }
},{
    timestamps : true
})

// Compound index to ensure a user can only wishlist a product once
wishlistSchema.index({ userId: 1, productId: 1 }, { unique: true })

const WishlistModel = mongoose.model('Wishlist', wishlistSchema)

export default WishlistModel
