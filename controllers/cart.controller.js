import CartProductModel from "../models/cartproduct.model.js";
import UserModel from "../models/user.model.js";
import ProductModel from "../models/product.model.js";

export const addToCartItemController = async(request,response)=>{
    try {
        const  userId = request.userId
        const { productId, selectedSize, selectedVariant, podData } = request.body
        
        if(!productId){
            return response.status(402).json({
                message : "Provide productId",
                error : true,
                success : false
            })
        }

        // Check if product exists and has stock
        const product = await ProductModel.findById(productId)
        if (!product) {
            return response.status(404).json({
                message : "Product not found",
                error : true,
                success : false
            })
        }

        // Handle variant validation for products that have variants
        if (product.hasVariants) {
            if (!selectedVariant) {
                return response.status(400).json({
                    message : "Variant selection is required for this product",
                    error : true,
                    success : false
                })
            }

            // Check if the selected variant exists and has stock
            const variantData = product.variants.find(variant => variant.name === selectedVariant.name)
            if (!variantData) {
                return response.status(400).json({
                    message : "Selected variant is not available",
                    error : true,
                    success : false
                })
            }

            if (!variantData.isActive) {
                return response.status(400).json({
                    message : "Selected variant is not active",
                    error : true,
                    success : false
                })
            }

            if (variantData.stock <= 0) {
                return response.status(400).json({
                    message : "Selected variant is out of stock",
                    error : true,
                    success : false
                })
            }
        }
        // Handle size validation for products that require size
        else if (product.requiresSize) {
            if (!selectedSize) {
                return response.status(400).json({
                    message : "Size selection is required for this product",
                    error : true,
                    success : false
                })
            }

            // Check if the selected size exists and has stock
            const sizeData = product.sizes.find(size => size.size === selectedSize)
            if (!sizeData) {
                return response.status(400).json({
                    message : "Selected size is not available",
                    error : true,
                    success : false
                })
            }

            if (sizeData.stock <= 0) {
                return response.status(400).json({
                    message : "Selected size is out of stock",
                    error : true,
                    success : false
                })
            }
        } else {
            // For products without size or variants, check regular stock
            if (product.stock === 0) {
                return response.status(400).json({
                    message : "Product is out of stock",
                    error : true,
                    success : false
                })
            }
        }

        // Handle POD validation
        if (product.isPOD && product.podFields && product.podFields.length > 0) {
            if (!podData || typeof podData !== 'object') {
                return response.status(400).json({
                    message : "POD data is required for this product",
                    error : true,
                    success : false
                })
            }

            // Validate each required POD field
            for (const field of product.podFields) {
                if (field.required) {
                    const fieldValue = podData[field.name]
                    if (!fieldValue || (typeof fieldValue === 'string' && fieldValue.trim() === '')) {
                        return response.status(400).json({
                            message : `${field.label} is required`,
                            error : true,
                            success : false
                        })
                    }
                }
            }
        }

        // Build query based on product type
        let cartQuery = {
            userId : userId,
            productId : productId
        }

        if (product.hasVariants) {
            cartQuery.selectedVariant = selectedVariant
        } else if (product.requiresSize) {
            cartQuery.selectedSize = selectedSize || null
        }

        const checkItemCart = await CartProductModel.findOne(cartQuery)

        if(checkItemCart){
            // If item already exists, update quantity if it doesn't exceed stock
            let maxStock = product.stock
            if (product.hasVariants && selectedVariant) {
                const variantData = product.variants.find(variant => variant.name === selectedVariant.name)
                maxStock = variantData ? variantData.stock : 0
            } else if (product.requiresSize && selectedSize) {
                const sizeData = product.sizes.find(size => size.size === selectedSize)
                maxStock = sizeData ? sizeData.stock : 0
            }

            if (checkItemCart.quantity < maxStock) {
                const updatedCartItem = await CartProductModel.findByIdAndUpdate(
                    checkItemCart._id,
                    { quantity: checkItemCart.quantity + 1 },
                    { new: true }
                )
                
                return response.json({
                    data : updatedCartItem,
                    message : "Item quantity updated successfully",
                    error : false,
                    success : true
                })
            } else {
                return response.status(400).json({
                    message : `Only ${maxStock} items available in stock`,
                    error : true,
                    success : false
                })
            }
        }

        const cartItem = new CartProductModel({
            quantity : 1,
            userId : userId,
            productId : productId,
            selectedSize : selectedSize || null,
            selectedVariant : selectedVariant || null,
            podData : podData || new Map()
        })
        
        try {
            const save = await cartItem.save()
            
            const updateCartUser = await UserModel.updateOne({ _id : userId},{
                $push : { 
                    shopping_cart : productId
                }
            })

            return response.json({
                data : save,
                message : "Item add successfully",
                error : false,
                success : true
            })
        } catch (saveError) {
            // Handle duplicate key error
            if (saveError.code === 11000) {
                return response.status(400).json({
                    message : "Item already in cart",
                    error : true,
                    success : false
                })
            }
            throw saveError
        }

    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

export const getCartItemController = async(request,response)=>{
    try {
        const userId = request.userId

        const cartItem =  await CartProductModel.find({
            userId : userId
        }).populate('productId')

        return response.json({
            data : cartItem,
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

export const updateCartItemQtyController = async(request,response)=>{
    try {
        const userId = request.userId 
        const { _id,qty } = request.body

        if(!_id ||  !qty){
            return response.status(400).json({
                message : "provide _id, qty"
            })
        }

        // Get cart item to find product
        const cartItem = await CartProductModel.findOne({
            _id : _id,
            userId : userId
        }).populate('productId')

        if (!cartItem) {
            return response.status(404).json({
                message : "Cart item not found",
                error : true,
                success : false
            })
        }

        // Check stock availability
        if (qty > cartItem.productId.stock) {
            return response.status(400).json({
                message : `Only ${cartItem.productId.stock} items available in stock`,
                error : true,
                success : false
            })
        }

        const updateCartitem = await CartProductModel.updateOne({
            _id : _id,
            userId : userId
        },{
            quantity : qty
        })

        return response.json({
            message : "Update cart",
            success : true,
            error : false, 
            data : updateCartitem
        })

    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

export const deleteCartItemQtyController = async(request,response)=>{
    try {
      const userId = request.userId // middleware
      const { _id } = request.body 
      
      if(!_id){
        return response.status(400).json({
            message : "Provide _id",
            error : true,
            success : false
        })
      }

      const deleteCartItem  = await CartProductModel.deleteOne({_id : _id, userId : userId })

      return response.json({
        message : "Item remove",
        error : false,
        success : true,
        data : deleteCartItem
      })

    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}
