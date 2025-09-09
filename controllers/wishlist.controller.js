import WishlistModel from "../models/wishlist.model.js";

// Add product to wishlist
export const addToWishlistController = async(request, response) => {
    try {
        const userId = request.userId
        const { productId } = request.body
        
        if(!productId){
            return response.status(400).json({
                message : "Provide productId",
                error : true,
                success : false
            })
        }

        // Check if already in wishlist
        const existingWishlist = await WishlistModel.findOne({
            userId : userId,
            productId : productId
        })

        if(existingWishlist){
            return response.status(400).json({
                message : "Product already in wishlist",
                error : true,
                success : false
            })
        }

        // Add to wishlist
        const wishlistItem = new WishlistModel({
            userId : userId,
            productId : productId
        })
        const savedItem = await wishlistItem.save()

        return response.json({
            data : savedItem,
            message : "Product added to wishlist successfully",
            error : false,
            success : true
        })
        
    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

// Get user's wishlist
export const getWishlistController = async(request, response) => {
    try {
        const userId = request.userId
        
        const wishlistItems = await WishlistModel.find({ userId })
            .populate('productId')
            .sort({ createdAt: -1 })

        return response.json({
            data : wishlistItems,
            message : "Wishlist fetched successfully",
            error : false,
            success : true
        })
        
    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

// Remove product from wishlist
export const removeFromWishlistController = async(request, response) => {
    try {
        const userId = request.userId
        const { productId } = request.body
        
        if(!productId){
            return response.status(400).json({
                message : "Provide productId",
                error : true,
                success : false
            })
        }

        const deletedItem = await WishlistModel.findOneAndDelete({
            userId : userId,
            productId : productId
        })

        if(!deletedItem){
            return response.status(404).json({
                message : "Product not found in wishlist",
                error : true,
                success : false
            })
        }

        return response.json({
            message : "Product removed from wishlist successfully",
            error : false,
            success : true
        })
        
    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

// Check if product is in wishlist
export const checkWishlistController = async(request, response) => {
    try {
        const userId = request.userId
        const { productId } = request.params
        
        if(!productId){
            return response.status(400).json({
                message : "Provide productId",
                error : true,
                success : false
            })
        }

        const wishlistItem = await WishlistModel.findOne({
            userId : userId,
            productId : productId
        })

        return response.json({
            data : {
                isWishlisted: !!wishlistItem
            },
            message : "Wishlist status checked successfully",
            error : false,
            success : true
        })
        
    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}
