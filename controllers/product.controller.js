import ProductModel from "../models/product.model.js";
import CategoryModel from "../models/category.model.js";
import SubCategoryModel from "../models/subCategory.model.js";
import InventoryModel from "../models/inventory.model.js";
import { isValidObjectId } from "../utils/objectIdUtils.js";
import SiteSettingsModel from "../models/siteSettings.model.js";

// Helper function to build stock query based on site settings
const buildStockQuery = async () => {
  try {
    const settings = await SiteSettingsModel.getSettings()
    const showOutOfStock = settings.productSettings?.showOutOfStockProducts || false
    
    if (showOutOfStock) {
      // Show all products (including out-of-stock)
      return {}
    } else {
      // Hide out-of-stock products (default behavior)
      return {
        $or: [
          // For products with variants
          { 
            hasVariants: true,
            "variants.stock": { $gt: 0 },
            "variants.isActive": true
          },
          // For products with sizes
          { 
            requiresSize: true,
            hasVariants: { $ne: true },
            "sizes.stock": { $gt: 0 }
          },
          // For products without sizes or variants
          { 
            requiresSize: { $ne: true },
            hasVariants: { $ne: true },
            stock: { $gt: 0 }
          },
          // Products with null/undefined stock (legacy)
          { 
            requiresSize: { $ne: true },
            hasVariants: { $ne: true },
            stock: null 
          },
          { 
            requiresSize: { $ne: true },
            hasVariants: { $ne: true },
            stock: { $exists: false }
          }
        ]
      }
    }
  } catch (error) {
    // Default to hiding out-of-stock products if settings can't be retrieved
    return {
      $or: [
        // For products with variants
        { 
          hasVariants: true,
          "variants.stock": { $gt: 0 },
          "variants.isActive": true
        },
        // For products with sizes
        { 
          requiresSize: true,
          hasVariants: { $ne: true },
          "sizes.stock": { $gt: 0 }
        },
        // For products without sizes or variants
        { 
          requiresSize: { $ne: true },
          hasVariants: { $ne: true },
          stock: { $gt: 0 }
        },
        // Products with null/undefined stock (legacy)
        { 
          requiresSize: { $ne: true },
          hasVariants: { $ne: true },
          stock: null 
        },
        { 
          requiresSize: { $ne: true },
          hasVariants: { $ne: true },
          stock: { $exists: false }
        }
      ]
    }
  }
}

export const createProductController = async(request,response)=>{
    try {
        const { 
            name ,
            image ,
            category,
            subCategory,
            unit,
            stock,
            price,
            discount,
            description,
            more_details,
            sizes,
            requiresSize,
            hasVariants,
            variants,
            isPOD,
            podFields,
        } = request.body 

        if(!name || !image[0] || !category[0] || !unit || !description ){
            return response.status(400).json({
                message : "Enter required fields",
                error : true,
                success : false
            })
        }

        // Validate price requirements based on product type
        if (!hasVariants && !price) {
            return response.status(400).json({
                message: "Price is required for products without variants",
                error: true,
                success: false
            })
        }

        // Validate sizes if product requires size
        if (requiresSize) {
            if (!sizes || !Array.isArray(sizes) || sizes.length === 0) {
                return response.status(400).json({
                    message: "At least one size is required for products that require size selection",
                    error: true,
                    success: false
                })
            }

            // Validate each size
            for (const size of sizes) {
                if (!size.size || typeof size.size !== 'string' || size.size.trim() === '') {
                    return response.status(400).json({
                        message: "Size name is required for all sizes",
                        error: true,
                        success: false
                    })
                }
                if (typeof size.stock !== 'number' || size.stock < 0) {
                    return response.status(400).json({
                        message: "Stock must be a non-negative number for all sizes",
                        error: true,
                        success: false
                    })
                }
            }
        }

        // Validate variants if product has variants
        if (hasVariants) {
            if (!variants || !Array.isArray(variants) || variants.length === 0) {
                return response.status(400).json({
                    message: "At least one variant is required for products with variants",
                    error: true,
                    success: false
                })
            }

            // Validate each variant
            for (const variant of variants) {
                if (!variant.name || typeof variant.name !== 'string' || variant.name.trim() === '') {
                    return response.status(400).json({
                        message: "Variant name is required for all variants",
                        error: true,
                        success: false
                    })
                }
                if (typeof variant.price !== 'number' || variant.price < 0) {
                    return response.status(400).json({
                        message: "Variant price must be a non-negative number for all variants",
                        error: true,
                        success: false
                    })
                }
                if (typeof variant.stock !== 'number' || variant.stock < 0) {
                    return response.status(400).json({
                        message: "Variant stock must be a non-negative number for all variants",
                        error: true,
                        success: false
                    })
                }
                if (typeof variant.discount !== 'number' || variant.discount < 0 || variant.discount > 100) {
                    return response.status(400).json({
                        message: "Variant discount must be between 0 and 100 for all variants",
                        error: true,
                        success: false
                    })
                }
            }
        }

        // Validate POD fields if product is POD
        if (isPOD) {
            if (!podFields || !Array.isArray(podFields) || podFields.length === 0) {
                return response.status(400).json({
                    message: "At least one POD field is required for POD products",
                    error: true,
                    success: false
                })
            }

            // Validate each POD field
            for (const field of podFields) {
                if (!field.name || !field.label || !field.type) {
                    return response.status(400).json({
                        message: "POD fields must have name, label, and type",
                        error: true,
                        success: false
                    })
                }

                // Validate field type
                const validTypes = ['text', 'textarea', 'file', 'date', 'number', 'email', 'phone', 'select', 'radio', 'checkbox']
                if (!validTypes.includes(field.type)) {
                    return response.status(400).json({
                        message: `Invalid field type: ${field.type}. Valid types are: ${validTypes.join(', ')}`,
                        error: true,
                        success: false
                    })
                }

                // Validate options for select, radio, and checkbox fields
                if (['select', 'radio', 'checkbox'].includes(field.type)) {
                    if (!field.options || !Array.isArray(field.options) || field.options.length === 0) {
                        return response.status(400).json({
                            message: `${field.type} fields must have at least one option`,
                            error: true,
                            success: false
                        })
                    }
                    
                    // Validate that all options are non-empty strings
                    for (const option of field.options) {
                        if (!option || typeof option !== 'string' || option.trim() === '') {
                            return response.status(400).json({
                                message: "All options must be non-empty strings",
                                error: true,
                                success: false
                            })
                        }
                    }
                }
            }
        }

        const product = new ProductModel({
            name ,
            image ,
            category,
            subCategory,
            unit,
            stock,
            price,
            discount,
            description,
            more_details,
            sizes: sizes || [],
            requiresSize: requiresSize || false,
            hasVariants: hasVariants || false,
            variants: variants || [],
            isPOD: isPOD || false,
            podFields: podFields || [],
        })
        const saveProduct = await product.save()

        // Automatically create inventory record for the new product
        try {
            // Calculate total stock based on product type
            let totalStock = 0;
            let sizeInventory = [];
            let variantInventory = [];

            if (requiresSize && sizes && sizes.length > 0) {
                // For products with sizes
                sizeInventory = sizes.map(size => ({
                    size: size.size,
                    currentStock: size.stock || 0,
                    reservedStock: 0,
                    availableStock: size.stock || 0
                }));
                totalStock = sizes.reduce((sum, size) => sum + (size.stock || 0), 0);
            } else if (hasVariants && variants && variants.length > 0) {
                // For products with variants
                variantInventory = variants.map(variant => ({
                    variantName: variant.name,
                    currentStock: variant.stock || 0,
                    reservedStock: 0,
                    availableStock: variant.stock || 0
                }));
                totalStock = variants.reduce((sum, variant) => sum + (variant.stock || 0), 0);
            } else {
                // For regular products
                totalStock = stock || 0;
            }

            // Create inventory record
            const inventory = new InventoryModel({
                product: saveProduct._id,
                currentStock: totalStock,
                availableStock: totalStock,
                sizeInventory,
                variantInventory,
                lowStockThreshold: 10,
                reorderPoint: 5,
                reorderQuantity: 50,
                autoReorder: {
                    enabled: false,
                    threshold: 5,
                    quantity: 50
                }
            });

            await inventory.save();

            // Add initial stock movement
            if (totalStock > 0) {
                inventory.stockMovements.push({
                    type: 'initial',
                    quantity: totalStock,
                    previousStock: 0,
                    newStock: totalStock,
                    reference: 'Product Creation',
                    notes: 'Initial stock from product creation',
                    performedBy: request.userId,
                    cost: 0
                });
                await inventory.save();
            }

        } catch (inventoryError) {
            console.error('Error creating inventory for product:', inventoryError);
            // Don't fail the product creation if inventory creation fails
            // The inventory can be created manually later
        }

        return response.json({
            message : "Product Created Successfully",
            data : saveProduct,
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

export const getProductController = async(request,response)=>{
    try {
        
        let { page, limit, search } = request.body 

        if(!page){
            page = 1
        }

        if(!limit){
            limit = 10
        }

        // Base query - only show published products
        let query = { 
            publish: true
        }
        
        // Add stock filtering based on site settings
        const stockQuery = await buildStockQuery()
        if (Object.keys(stockQuery).length > 0) {
            Object.assign(query, stockQuery)
        }

        // Add search if provided
        if(search && search.trim()){
            const searchRegex = new RegExp(search.trim(), 'i') // case-insensitive search
            query.$and = [{
                $or: [
                    { name: searchRegex },
                    { description: searchRegex }
                ]
            }]
        }

        const skip = (page - 1) * limit

        const [data,totalCount] = await Promise.all([
            ProductModel.find(query).sort({createdAt : -1 }).skip(skip).limit(limit).populate('category subCategory'),
            ProductModel.countDocuments(query)
        ])

        return response.json({
            message : "Product data",
            error : false,
            success : true,
            totalCount : totalCount,
            totalNoPage : Math.ceil( totalCount / limit),
            data : data
        })
    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

// New controller for out-of-stock products (admin only)
export const getOutOfStockProductsController = async(request,response)=>{
    try {
        
        let { page, limit, search } = request.body 

        if(!page){
            page = 1
        }

        if(!limit){
            limit = 10
        }

        // Query for out-of-stock products (stock = 0 or stock exists and is 0)
        let query = { 
            $or: [
                { stock: 0 },
                { stock: { $exists: true, $ne: null, $eq: 0 } }
            ]
        }

        // Add search if provided
        if(search && search.trim()){
            const searchRegex = new RegExp(search.trim(), 'i') // case-insensitive search
            query.$and = [{
                $or: [
                    { name: searchRegex },
                    { description: searchRegex }
                ]
            }]
        }

        const skip = (page - 1) * limit

        const [data,totalCount] = await Promise.all([
            ProductModel.find(query).sort({createdAt : -1 }).skip(skip).limit(limit).populate('category subCategory'),
            ProductModel.countDocuments(query)
        ])

        return response.json({
            message : "Out of stock products",
            error : false,
            success : true,
            totalCount : totalCount,
            totalNoPage : Math.ceil( totalCount / limit),
            data : data
        })
    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

export const getLowStockProductsController = async(request,response)=>{
    try {
        
        let { page, limit, search, threshold } = request.body 

        if(!page){
            page = 1
        }

        if(!limit){
            limit = 10
        }

        // Get low stock threshold - use provided threshold or fall back to site settings
        let lowStockThreshold;
        if (threshold && threshold > 0) {
            lowStockThreshold = threshold;
            console.log('Using provided threshold:', lowStockThreshold);
        } else {
            const settings = await SiteSettingsModel.getSettings()
            lowStockThreshold = settings.productSettings?.lowStockThreshold || 3
            console.log('Using site settings threshold:', lowStockThreshold);
        }

        // Query for low stock products (stock > 0 and stock < threshold)
        let query = { 
            $and: [
                { stock: { $gt: 0 } },
                { stock: { $lt: lowStockThreshold } }
            ]
        }

        // Add search if provided
        if(search && search.trim()){
            const searchRegex = new RegExp(search.trim(), 'i') // case-insensitive search
            query.$and.push({
                $or: [
                    { name: searchRegex },
                    { description: searchRegex }
                ]
            })
        }

        const skip = (page - 1) * limit

        const [data,totalCount] = await Promise.all([
            ProductModel.find(query).sort({createdAt : -1 }).skip(skip).limit(limit).populate('category subCategory'),
            ProductModel.countDocuments(query)
        ])

        return response.json({
            message : "Low stock products",
            error : false,
            success : true,
            totalCount : totalCount,
            totalNoPage : Math.ceil( totalCount / limit),
            data : data,
            lowStockThreshold: lowStockThreshold
        })
    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

// Debug endpoint to check all products
export const debugAllProducts = async(request,response)=>{
    try {
        const products = await ProductModel.find({ publish: true }).populate('category subCategory').limit(20)
        const totalProducts = await ProductModel.countDocuments({ publish: true })
        
        // Debug information removed for production

        return response.json({
            message : "Debug product data",
            error : false,
            success : true,
            totalProducts: totalProducts,
            sampleProducts: products.map(p => ({
                _id: p._id,
                name: p.name,
                description: p.description?.substring(0, 100),
                category: p.category?.map(c => c.name),
                subCategory: p.subCategory?.map(s => s.name)
            }))
        })
    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

// Debug endpoint to check product prices
export const debugProductPrices = async(request,response)=>{
    try {
        const { categoryId } = request.body
        
        let query = { publish: true }
        if (categoryId) {
            query.category = { $in: [categoryId] }
        }
        
        const products = await ProductModel.find(query)
            .select('name price discount')
            .sort({ price: -1 })
            .limit(10)
            .lean()
        
        // Debug information removed for production

        return response.json({
            message : "Debug product prices",
            error : false,
            success : true,
            products: products
        })
    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

export const getProductByCategory = async(request,response)=>{
    try {
        const { 
            id, 
            page = 1, 
            limit = 12,
            minPrice,
            maxPrice,
            sortBy = 'relevance',
            discountOnly = false,
            minRating = 0
        } = request.body 

        if(!id){
            return response.status(400).json({
                message : "provide category id",
                error : true,
                success : false
            })
        }

        // Build query object
        let query = { 
            category : { $in : [id] },
            publish: true // Only show published products
        }
        
        // Add stock filtering based on site settings
        const stockQuery = await buildStockQuery()
        if (Object.keys(stockQuery).length > 0) {
            Object.assign(query, stockQuery)
        }

        // Add price range filter
        if (minPrice || maxPrice) {
            query.price = {}
            if (minPrice) query.price.$gte = Number(minPrice)
            if (maxPrice) query.price.$lte = Number(maxPrice)
        }

        // Add discount filter
        if (discountOnly) {
            query.discount = { $gt: 0 }
        }

        // Add rating filter
        if (minRating > 0) {
            query.averageRating = { $gte: Number(minRating) }
        }

        // Build sort object
        let sortObject = {}
        switch (sortBy) {
            case 'price_low':
                sortObject = { price: 1 }
                break
            case 'price_high':
                sortObject = { price: -1 }
                break
            case 'newest':
                sortObject = { createdAt: -1 }
                break
            case 'rating':
                sortObject = { averageRating: -1 }
                break
            case 'name_asc':
                sortObject = { name: 1 }
                break
            case 'name_desc':
                sortObject = { name: -1 }
                break
            case 'relevance':
            default:
                sortObject = { createdAt: -1 } // Default to newest first
                break
        }

        // For price sorting, ensure we have a secondary sort to make it deterministic
        if (sortBy === 'price_low' || sortBy === 'price_high') {
            sortObject._id = 1 // Secondary sort by _id to ensure consistent ordering
        }

        const skip = (page - 1) * limit

        // Add a small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50))

        let products, totalCount

        // For price sorting, we need to calculate discounted prices and sort in memory
        if (sortBy === 'price_low' || sortBy === 'price_high') {
            // First get all products without sorting
            const allProducts = await ProductModel.find(query)
                .populate('category subCategory')
                .lean()

            // Calculate discounted prices and sort in memory
            const productsWithDiscountedPrice = allProducts.map(product => {
                const originalPrice = Number(product.price) || 0
                const discount = Number(product.discount) || 0
                const discountedPrice = originalPrice - (originalPrice * discount / 100)
                
                return {
                    ...product,
                    originalPrice,
                    discountedPrice,
                    price: originalPrice // Keep original price for compatibility
                }
            })

            // Sort by discounted price
            productsWithDiscountedPrice.sort((a, b) => {
                if (sortBy === 'price_high') {
                    return b.discountedPrice - a.discountedPrice
                } else {
                    return a.discountedPrice - b.discountedPrice
                }
            })

            // Apply pagination
            const startIndex = (page - 1) * limit
            products = productsWithDiscountedPrice.slice(startIndex, startIndex + limit)
            totalCount = productsWithDiscountedPrice.length

        } else {
            // For non-price sorting, use database sorting
            [products, totalCount] = await Promise.all([
                ProductModel.find(query)
                    .populate('category subCategory')
                    .sort(sortObject)
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                ProductModel.countDocuments(query)
            ])
        }

        // Ensure price is a number for proper sorting
        products.forEach(product => {
            if (product.price !== null && product.price !== undefined) {
                product.price = Number(product.price)
            }
        })

        return response.json({
            message : "category product list",
            data : products,
            totalCount: totalCount,
            page: page,
            limit: limit,
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

export const getProductByCategoryAndSubCategory  = async(request,response)=>{
    try {
        const { categoryId,subCategoryId,page,limit } = request.body

        if(!categoryId || !subCategoryId){
            return response.status(400).json({
                message : "Provide categoryId and subCategoryId",
                error : true,
                success : false
            })
        }

        if(!page){
            page = 1
        }

        if(!limit){
            limit = 10
        }

        const query = {
            category : { $in :categoryId  },
            subCategory : { $in : subCategoryId },
            publish: true // Only show published products
        }
        
        // Add stock filtering based on site settings
        const stockQuery = await buildStockQuery()
        if (Object.keys(stockQuery).length > 0) {
            Object.assign(query, stockQuery)
        }

        const skip = (page - 1) * limit

        const [data,dataCount] = await Promise.all([
            ProductModel.find(query).sort({createdAt : -1 }).skip(skip).limit(limit),
            ProductModel.countDocuments(query)
        ])

        return response.json({
            message : "Product list",
            data : data,
            totalCount : dataCount,
            page : page,
            limit : limit,
            success : true,
            error : false
        })

    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

export const getProductDetails = async(request,response)=>{
    try {
        const { productId } = request.body 

        // Add validation for productId
        if (!productId) {
            return response.status(400).json({
                message: "Product ID is required",
                error: true,
                success: false
            });
        }

        // Validate that productId is a valid MongoDB ObjectId format
        if (!isValidObjectId(productId)) {
            return response.status(400).json({
                message: "Invalid product ID format",
                error: true,
                success: false
            });
        }

        const product = await ProductModel.findOne({ _id : productId })

        if (!product) {
            return response.status(404).json({
                message: "Product not found",
                error: true,
                success: false
            });
        }

        return response.json({
            message : "product details",
            data : product,
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

//update product
export const updateProductDetails = async(request,response)=>{
    try {
        const { _id, sizes, requiresSize, hasVariants, variants } = request.body 

        if(!_id){
            return response.status(400).json({
                message : "provide product _id",
                error : true,
                success : false
            })
        }

        // Validate sizes if product requires size
        if (requiresSize) {
            if (!sizes || !Array.isArray(sizes) || sizes.length === 0) {
                return response.status(400).json({
                    message: "At least one size is required for products that require size selection",
                    error: true,
                    success: false
                })
            }

            // Validate each size
            for (const size of sizes) {
                if (!size.size || typeof size.size !== 'string' || size.size.trim() === '') {
                    return response.status(400).json({
                        message: "Size name is required for all sizes",
                        error: true,
                        success: false
                    })
                }
                if (typeof size.stock !== 'number' || size.stock < 0) {
                    return response.status(400).json({
                        message: "Stock must be a non-negative number for all sizes",
                        error: true,
                        success: false
                    })
                }
            }
        }

        // Validate variants if product has variants
        if (hasVariants) {
            if (!variants || !Array.isArray(variants) || variants.length === 0) {
                return response.status(400).json({
                    message: "At least one variant is required for products with variants",
                    error: true,
                    success: false
                })
            }

            // Validate each variant
            for (const variant of variants) {
                if (!variant.name || typeof variant.name !== 'string' || variant.name.trim() === '') {
                    return response.status(400).json({
                        message: "Variant name is required for all variants",
                        error: true,
                        success: false
                    })
                }
                if (typeof variant.price !== 'number' || variant.price < 0) {
                    return response.status(400).json({
                        message: "Variant price must be a non-negative number for all variants",
                        error: true,
                        success: false
                    })
                }
                if (typeof variant.stock !== 'number' || variant.stock < 0) {
                    return response.status(400).json({
                        message: "Variant stock must be a non-negative number for all variants",
                        error: true,
                        success: false
                    })
                }
                if (typeof variant.discount !== 'number' || variant.discount < 0 || variant.discount > 100) {
                    return response.status(400).json({
                        message: "Variant discount must be between 0 and 100 for all variants",
                        error: true,
                        success: false
                    })
                }
            }
        }

        const updateProduct = await ProductModel.updateOne({ _id : _id },{
            ...request.body
        })

        // Update inventory record if it exists
        try {
            const existingInventory = await InventoryModel.findOne({ product: _id });
            
            if (existingInventory) {
                // Calculate total stock based on updated product type
                let totalStock = 0;
                let sizeInventory = [];
                let variantInventory = [];

                if (requiresSize && sizes && sizes.length > 0) {
                    // For products with sizes
                    sizeInventory = sizes.map(size => ({
                        size: size.size,
                        currentStock: size.stock || 0,
                        reservedStock: 0,
                        availableStock: size.stock || 0
                    }));
                    totalStock = sizes.reduce((sum, size) => sum + (size.stock || 0), 0);
                } else if (hasVariants && variants && variants.length > 0) {
                    // For products with variants
                    variantInventory = variants.map(variant => ({
                        variantName: variant.name,
                        currentStock: variant.stock || 0,
                        reservedStock: 0,
                        availableStock: variant.stock || 0
                    }));
                    totalStock = variants.reduce((sum, variant) => sum + (variant.stock || 0), 0);
                } else {
                    // For regular products
                    totalStock = request.body.stock || existingInventory.currentStock;
                }

                // Update inventory
                existingInventory.currentStock = totalStock;
                existingInventory.availableStock = totalStock;
                existingInventory.sizeInventory = sizeInventory;
                existingInventory.variantInventory = variantInventory;
                
                await existingInventory.save();

                // Add stock movement if stock changed
                const stockChange = totalStock - existingInventory.currentStock;
                if (stockChange !== 0) {
                    existingInventory.stockMovements.push({
                        type: 'adjustment',
                        quantity: stockChange,
                        previousStock: existingInventory.currentStock - stockChange,
                        newStock: totalStock,
                        reference: 'Product Update',
                        notes: 'Stock updated from product modification',
                        performedBy: request.userId,
                        cost: 0
                    });
                    await existingInventory.save();
                }
            }
        } catch (inventoryError) {
            console.error('Error updating inventory for product:', inventoryError);
            // Don't fail the product update if inventory update fails
        }

        return response.json({
            message : "updated successfully",
            data : updateProduct,
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

//delete product
export const deleteProductDetails = async(request,response)=>{
    try {
        const { _id } = request.body 

        if(!_id){
            return response.status(400).json({
                message : "provide _id ",
                error : true,
                success : false
            })
        }

        const deleteProduct = await ProductModel.deleteOne({_id : _id })

        // Delete associated inventory record
        try {
            await InventoryModel.deleteOne({ product: _id });
        } catch (inventoryError) {
            console.error('Error deleting inventory for product:', inventoryError);
            // Don't fail the product deletion if inventory deletion fails
        }

        return response.json({
            message : "Delete successfully",
            error : false,
            success : true,
            data : deleteProduct
        })
    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

//search product
export const searchProduct = async(request,response)=>{
    try {
        // Handle both POST and GET requests
        const requestData = request.method === 'GET' ? request.query : request.body
        let { search, page, limit, category, subCategory, minPrice, maxPrice, sortBy, discountOnly, minRating } = requestData
        
        // For GET requests, the search parameter might be 'q' instead of 'search'
        if (request.method === 'GET' && !search && requestData.q) {
            search = requestData.q
        }

        if(!page){
            page = 1
        }
        if(!limit){
            limit = 10
        }

        // Build search query
        let query = {
            publish: true // Only show published products
        }
        
        // Add stock filtering based on site settings
        const stockQuery = await buildStockQuery()
        if (Object.keys(stockQuery).length > 0) {
            query.$and = [stockQuery]
        } else {
            query.$and = []
        }
        
        // Text search - only add if search term is provided
        if(search && search.trim()) {
            // Simple regex search on name and description
            const searchRegex = new RegExp(search.trim(), 'i')
            query.$and.push({
                $or: [
                    { name: searchRegex },
                    { description: searchRegex }
                ]
            })
        }

        // Category filter
        if(category) {
            query.$and.push({ category: category })
        }

        // Sub-category filter
        if(subCategory) {
            query.$and.push({ subCategory: subCategory })
        }

        // Price range filter
        if(minPrice || maxPrice) {
            const priceFilter = {}
            if(minPrice) priceFilter.$gte = Number(minPrice)
            if(maxPrice) priceFilter.$lte = Number(maxPrice)
            query.$and.push({ price: priceFilter })
        }

        // Discount filter
        if(discountOnly === 'true') {
            query.$and.push({ discount: { $gt: 0 } })
        }

        // Rating filter
        if(minRating && minRating > 0) {
            query.$and.push({ rating: { $gte: Number(minRating) } })
        }

        // Build sort object
        let sortObject = { createdAt: -1 } // default sort
        if(sortBy) {
            switch(sortBy) {
                case 'price_low':
                    sortObject = { price: 1 }
                    break
                case 'price_high':
                    sortObject = { price: -1 }
                    break
                case 'newest':
                    sortObject = { createdAt: -1 }
                    break
                case 'rating':
                    sortObject = { rating: -1 }
                    break
                default:
                    sortObject = { createdAt: -1 }
            }
        }

        const skip = (page - 1) * limit
        
        const [data, dataCount] = await Promise.all([
            ProductModel.find(query)
                .sort(sortObject)
                .skip(skip)
                .limit(limit)
                .populate('category subCategory'),
            ProductModel.countDocuments(query)
        ])

        return response.json({
            message: "Product data",
            error: false,
            success: true,
            data: data,
            totalCount: dataCount,
            totalPage: Math.ceil(dataCount/limit),
            page: page,
            limit: limit
        })

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

// Search suggestions controller
export const getSearchSuggestions = async (request, response) => {
    try {
        const { query } = request.query
        
        if (!query || query.trim().length < 2) {
            return response.json({
                message: "Query must be at least 2 characters",
                error: false,
                success: true,
                data: []
            })
        }

        const searchRegex = new RegExp(query.trim(), 'i')
        
        // Get product suggestions with better ranking
        const products = await ProductModel.find({
            $or: [
                { name: searchRegex },
                { description: searchRegex }
            ],
            publish: true
        })
        .select('_id name description rating image price discount')
        .limit(8)
        .sort({ rating: -1, createdAt: -1 })

        // Get category suggestions
        const categories = await CategoryModel.find({
            name: searchRegex
        })
        .select('name')
        .limit(4)
        .sort({ createdAt: -1 })

        // Get subcategory suggestions
        const subcategories = await SubCategoryModel.find({
            name: searchRegex
        })
        .select('name')
        .limit(4)
        .sort({ createdAt: -1 })

        // Create suggestions with better structure
        const suggestions = [
            // Prioritize products with higher ratings
            ...products.map(p => ({ 
                type: 'product', 
                name: p.name, 
                description: p.description?.substring(0, 50) + '...',
                rating: p.rating || 0,
                _id: p._id,
                image: p.image,
                price: p.price,
                discount: p.discount
            })),
            ...categories.map(c => ({ 
                type: 'category', 
                name: c.name 
            })),
            ...subcategories.map(s => ({ 
                type: 'subcategory', 
                name: s.name 
            }))
        ]

        // Sort suggestions by relevance (products first, then categories, then subcategories)
        const sortedSuggestions = suggestions.sort((a, b) => {
            // Products with higher ratings first
            if (a.type === 'product' && b.type === 'product') {
                return (b.rating || 0) - (a.rating || 0)
            }
            // Products before categories
            if (a.type === 'product' && b.type !== 'product') return -1
            if (a.type !== 'product' && b.type === 'product') return 1
            // Categories before subcategories
            if (a.type === 'category' && b.type === 'subcategory') return -1
            if (a.type === 'subcategory' && b.type === 'category') return 1
            return 0
        })

        return response.json({
            message: "Search suggestions",
            error: false,
            success: true,
            data: sortedSuggestions.slice(0, 12) // Limit to 12 total suggestions
        })

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}