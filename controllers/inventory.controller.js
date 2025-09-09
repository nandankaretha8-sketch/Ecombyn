import ProductModel from "../models/product.model.js";
import SiteSettingsModel from "../models/siteSettings.model.js";
import { isValidObjectId } from "../utils/objectIdUtils.js";

// Get complete inventory analytics from ProductModel
export const getInventoryAnalyticsController = async (request, response) => {
    try {
        console.log('Getting inventory analytics from ProductModel...');
        
        // Get low stock threshold from site settings
        const settings = await SiteSettingsModel.getSettings();
        const lowStockThreshold = settings.productSettings?.lowStockThreshold || 3;

        // Get all published products directly from ProductModel
        const allProducts = await ProductModel.find({ publish: true })
            .populate('category subCategory')
            .lean();

        console.log(`Found ${allProducts.length} published products`);

        // Calculate analytics directly from product data
        const analytics = {
            totalProducts: allProducts.length,
            totalStock: 0,
            totalReserved: 0, // Not applicable when using ProductModel directly
            totalAvailable: 0,
            totalValue: 0,
            lowStockItems: 0,
            outOfStockItems: 0
        };

        // Process each product to calculate real stock values
        allProducts.forEach(product => {
            let productStock = 0;
            
            // Calculate stock based on product type
            if (product.requiresSize && product.sizes && product.sizes.length > 0) {
                // Product with sizes
                productStock = product.sizes.reduce((sum, size) => {
                    const stockValue = parseInt(size.stock) || 0;
                    return sum + stockValue;
                }, 0);
            } else if (product.hasVariants && product.variants && product.variants.length > 0) {
                // Product with variants
                productStock = product.variants.reduce((sum, variant) => {
                    const stockValue = parseInt(variant.stock) || 0;
                    return sum + stockValue;
                }, 0);
            } else {
                // Regular product
                productStock = parseInt(product.stock) || 0;
            }

            const price = parseFloat(product.price) || 0;
            const discount = parseFloat(product.discount) || 0;
            const discountedPrice = price - (price * discount / 100);
            
            analytics.totalStock += productStock;
            analytics.totalAvailable += productStock;
            analytics.totalValue += productStock * discountedPrice;
            
            if (productStock <= lowStockThreshold && productStock > 0) {
                analytics.lowStockItems++;
            }
            
            if (productStock === 0) {
                analytics.outOfStockItems++;
            }
        });

        console.log('Analytics calculated:', {
            totalProducts: analytics.totalProducts,
            totalStock: analytics.totalStock,
            totalValue: analytics.totalValue,
            lowStockItems: analytics.lowStockItems
        });

        // Get top products by stock value
        const topProductsByValue = allProducts
            .map(product => {
                let productStock = 0;
                
                // Calculate stock based on product type
                if (product.requiresSize && product.sizes && product.sizes.length > 0) {
                    productStock = product.sizes.reduce((sum, size) => {
                        const stockValue = parseInt(size.stock) || 0;
                        return sum + stockValue;
                    }, 0);
                } else if (product.hasVariants && product.variants && product.variants.length > 0) {
                    productStock = product.variants.reduce((sum, variant) => {
                        const stockValue = parseInt(variant.stock) || 0;
                        return sum + stockValue;
                    }, 0);
                } else {
                    productStock = parseInt(product.stock) || 0;
                }

                const price = parseFloat(product.price) || 0;
                const discount = parseFloat(product.discount) || 0;
                const discountedPrice = price - (price * discount / 100);
                const totalValue = productStock * discountedPrice;
                
                return {
                    product: {
                        _id: product._id,
                        name: product.name,
                        image: product.image,
                        price: product.price,
                        discount: product.discount
                    },
                    currentStock: productStock,
                    totalValue: totalValue
                };
            })
            .filter(product => product.currentStock > 0)
            .sort((a, b) => b.totalValue - a.totalValue)
            .slice(0, 10);

        console.log(`Top products calculated: ${topProductsByValue.length} products`);

        response.status(200).json({
            message: "Inventory analytics retrieved successfully from ProductModel",
            data: {
                summary: analytics,
                stockMovements: [], // Not applicable with ProductModel
                topProductsByValue: topProductsByValue,
                lastUpdated: new Date().toISOString(),
                note: "Stock data calculated directly from ProductModel - Clean and accurate"
            },
            success: true
        });

    } catch (error) {
        console.error("Get inventory analytics error:", error);
        response.status(500).json({
            message: "Error retrieving inventory analytics",
            error: true,
            success: false
        });
    }
};

// Get low stock products directly from ProductModel
export const getLowStockProductsController = async (request, response) => {
    try {
        const { page = 1, limit = 20, threshold } = request.query;
        
        // Get low stock threshold
        const settings = await SiteSettingsModel.getSettings();
        const lowStockThreshold = threshold || settings.productSettings?.lowStockThreshold || 3;

        console.log(`Getting low stock products with threshold: ${lowStockThreshold}`);

        // Build query for low stock products
        const query = {
            publish: true,
            $or: [
                // Regular products with basic stock
                {
                    requiresSize: { $ne: true },
                    hasVariants: { $ne: true },
                    stock: { $gt: 0, $lt: lowStockThreshold }
                },
                // Products with sizes that have low stock
                {
                    requiresSize: true,
                    "sizes.stock": { $gt: 0, $lt: lowStockThreshold }
                },
                // Products with variants that have low stock
                {
                    hasVariants: true,
                    "variants.stock": { $gt: 0, $lt: lowStockThreshold }
                }
            ]
        };

        const skip = (page - 1) * limit;

        // Get low stock products
        const [products, totalCount] = await Promise.all([
            ProductModel.find(query)
                .populate('category subCategory')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            ProductModel.countDocuments(query)
        ]);

        console.log(`Found ${products.length} low stock products out of ${totalCount} total`);

        response.status(200).json({
            message: "Low stock products retrieved successfully",
            data: {
                products,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / limit),
                    totalItems: totalCount,
                    itemsPerPage: parseInt(limit)
                },
                lowStockThreshold
            },
            success: true
        });

    } catch (error) {
        console.error("Get low stock products error:", error);
        response.status(500).json({
            message: "Error retrieving low stock products",
            error: true,
            success: false
        });
    }
};

// Get out of stock products directly from ProductModel
export const getOutOfStockProductsController = async (request, response) => {
    try {
        const { page = 1, limit = 20 } = request.query;

        console.log('Getting out of stock products...');

        // Build query for out of stock products
        const query = {
            publish: true,
            $or: [
                // Regular products with no stock
                {
                    requiresSize: { $ne: true },
                    hasVariants: { $ne: true },
                    stock: 0
                },
                // Products with sizes that have no stock
                {
                    requiresSize: true,
                    $and: [
                        { "sizes.stock": { $exists: true } },
                        { "sizes.stock": { $not: { $gt: 0 } } }
                    ]
                },
                // Products with variants that have no stock
                {
                    hasVariants: true,
                    $and: [
                        { "variants.stock": { $exists: true } },
                        { "variants.stock": { $not: { $gt: 0 } } }
                    ]
                }
            ]
        };

        const skip = (page - 1) * limit;

        // Get out of stock products
        const [products, totalCount] = await Promise.all([
            ProductModel.find(query)
                .populate('category subCategory')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            ProductModel.countDocuments(query)
        ]);

        console.log(`Found ${products.length} out of stock products out of ${totalCount} total`);

        response.status(200).json({
            message: "Out of stock products retrieved successfully",
            data: {
                products,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / limit),
                    totalItems: totalCount,
                    itemsPerPage: parseInt(limit)
                }
            },
            success: true
        });

    } catch (error) {
        console.error("Get out of stock products error:", error);
        response.status(500).json({
            message: "Error retrieving out of stock products",
            error: true,
            success: false
        });
    }
};

// Get inventory overview with real-time data
export const getInventoryOverviewController = async (request, response) => {
    try {
        console.log('Getting inventory overview...');
        
        // Get all published products
        const allProducts = await ProductModel.find({ publish: true })
            .populate('category subCategory')
            .lean();

        // Calculate overview metrics
        const overview = {
            totalProducts: allProducts.length,
            totalStock: 0,
            totalValue: 0,
            lowStockItems: 0,
            outOfStockItems: 0,
            productsByCategory: {},
            stockDistribution: {
                low: 0,      // 1-3 items
                medium: 0,   // 4-10 items
                high: 0,     // 11+ items
                out: 0       // 0 items
            }
        };

        // Get low stock threshold
        const settings = await SiteSettingsModel.getSettings();
        const lowStockThreshold = settings.productSettings?.lowStockThreshold || 3;

        allProducts.forEach(product => {
            let productStock = 0;
            
            // Calculate stock based on product type
            if (product.requiresSize && product.sizes && product.sizes.length > 0) {
                productStock = product.sizes.reduce((sum, size) => {
                    const stockValue = parseInt(size.stock) || 0;
                    return sum + stockValue;
                }, 0);
            } else if (product.hasVariants && product.variants && product.variants.length > 0) {
                productStock = product.variants.reduce((sum, variant) => {
                    const stockValue = parseInt(variant.stock) || 0;
                    return sum + stockValue;
                }, 0);
            } else {
                productStock = parseInt(product.stock) || 0;
            }

            const price = parseFloat(product.price) || 0;
            const discount = parseFloat(product.discount) || 0;
            const discountedPrice = price - (price * discount / 100);
            
            overview.totalStock += productStock;
            overview.totalValue += productStock * discountedPrice;
            
            // Categorize stock levels
            if (productStock === 0) {
                overview.outOfStockItems++;
                overview.stockDistribution.out++;
            } else if (productStock <= lowStockThreshold) {
                overview.lowStockItems++;
                overview.stockDistribution.low++;
            } else if (productStock <= 10) {
                overview.stockDistribution.medium++;
            } else {
                overview.stockDistribution.high++;
            }

            // Group by category
            if (product.category && product.category.length > 0) {
                product.category.forEach(cat => {
                    const categoryName = cat.name || 'Uncategorized';
                    if (!overview.productsByCategory[categoryName]) {
                        overview.productsByCategory[categoryName] = {
                            count: 0,
                            totalStock: 0,
                            totalValue: 0
                        };
                    }
                    overview.productsByCategory[categoryName].count++;
                    overview.productsByCategory[categoryName].totalStock += productStock;
                    overview.productsByCategory[categoryName].totalValue += productStock * discountedPrice;
                });
            }
        });

        console.log('Inventory overview calculated successfully');

        response.status(200).json({
            message: "Inventory overview retrieved successfully",
            data: overview,
            success: true
        });

    } catch (error) {
        console.error("Get inventory overview error:", error);
        response.status(500).json({
            message: "Error retrieving inventory overview",
            error: true,
            success: false
        });
    }
};

// Get product stock details
export const getProductStockDetailsController = async (request, response) => {
    try {
        const { productId } = request.params;
        
        if (!productId || !isValidObjectId(productId)) {
            return response.status(400).json({
                message: "Valid product ID is required",
                error: true,
                success: false
            });
        }

        // Get product with fresh data
        const product = await ProductModel.findById(productId)
            .populate('category subCategory')
            .lean();

        if (!product) {
            return response.status(404).json({
                message: "Product not found",
                error: true,
                success: false
            });
        }

        // Calculate stock details
        let stockDetails = {
            totalStock: 0,
            stockBreakdown: {},
            stockStatus: 'unknown'
        };

        if (product.requiresSize && product.sizes && product.sizes.length > 0) {
            // Product with sizes
            stockDetails.stockBreakdown = {
                type: 'sizes',
                sizes: product.sizes.map(size => ({
                    size: size.size,
                    stock: parseInt(size.stock) || 0
                }))
            };
            stockDetails.totalStock = stockDetails.stockBreakdown.sizes.reduce((sum, size) => sum + size.stock, 0);
        } else if (product.hasVariants && product.variants && product.variants.length > 0) {
            // Product with variants
            stockDetails.stockBreakdown = {
                type: 'variants',
                variants: product.variants.map(variant => ({
                    name: variant.name,
                    stock: parseInt(variant.stock) || 0
                }))
            };
            stockDetails.totalStock = stockDetails.stockBreakdown.variants.reduce((sum, variant) => sum + variant.stock, 0);
        } else {
            // Regular product
            stockDetails.stockBreakdown = {
                type: 'basic',
                stock: parseInt(product.stock) || 0
            };
            stockDetails.totalStock = stockDetails.stockBreakdown.stock;
        }

        // Determine stock status
        const settings = await SiteSettingsModel.getSettings();
        const lowStockThreshold = settings.productSettings?.lowStockThreshold || 3;

        if (stockDetails.totalStock === 0) {
            stockDetails.stockStatus = 'out_of_stock';
        } else if (stockDetails.totalStock <= lowStockThreshold) {
            stockDetails.stockStatus = 'low_stock';
        } else {
            stockDetails.stockStatus = 'in_stock';
        }

        response.status(200).json({
            message: "Product stock details retrieved successfully",
            data: {
                product: {
                    _id: product._id,
                    name: product.name,
                    category: product.category,
                    subCategory: product.subCategory
                },
                stockDetails,
                lastChecked: new Date().toISOString()
            },
            success: true
        });

    } catch (error) {
        console.error("Get product stock details error:", error);
        response.status(500).json({
            message: "Error retrieving product stock details",
            error: true,
            success: false
        });
    }
};

// Search products by stock criteria
export const searchProductsByStockController = async (request, response) => {
    try {
        const { 
            page = 1, 
            limit = 20, 
            stockLevel, // 'low', 'out', 'in'
            categoryId,
            search
        } = request.query;

        console.log('Searching products by stock criteria...');

        // Build base query
        let query = { publish: true };
        
        // Add stock level filter
        if (stockLevel) {
            const settings = await SiteSettingsModel.getSettings();
            const lowStockThreshold = settings.productSettings?.lowStockThreshold || 3;

            switch (stockLevel) {
                case 'low':
                    query.$or = [
                        {
                            requiresSize: { $ne: true },
                            hasVariants: { $ne: true },
                            stock: { $gt: 0, $lte: lowStockThreshold }
                        },
                        {
                            requiresSize: true,
                            "sizes.stock": { $gt: 0, $lte: lowStockThreshold }
                        },
                        {
                            hasVariants: true,
                            "variants.stock": { $gt: 0, $lte: lowStockThreshold }
                        }
                    ];
                    break;
                case 'out':
                    query.$or = [
                        {
                            requiresSize: { $ne: true },
                            hasVariants: { $ne: true },
                            stock: 0
                        },
                        {
                            requiresSize: true,
                            $and: [
                                { "sizes.stock": { $exists: true } },
                                { "sizes.stock": { $not: { $gt: 0 } } }
                            ]
                        },
                        {
                            hasVariants: true,
                            $and: [
                                { "variants.stock": { $exists: true } },
                                { "variants.stock": { $not: { $gt: 0 } } }
                            ]
                        }
                    ];
                    break;
                case 'in':
                    query.$or = [
                        {
                            requiresSize: { $ne: true },
                            hasVariants: { $ne: true },
                            stock: { $gt: lowStockThreshold }
                        },
                        {
                            requiresSize: true,
                            "sizes.stock": { $gt: lowStockThreshold }
                        },
                        {
                            hasVariants: true,
                            "variants.stock": { $gt: lowStockThreshold }
                        }
                    ];
                    break;
            }
        }

        // Add category filter
        if (categoryId) {
            query.category = { $in: [categoryId] };
        }

        // Add search filter
        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            query.$and = [{
                $or: [
                    { name: searchRegex },
                    { description: searchRegex }
                ]
            }];
        }

        const skip = (page - 1) * limit;

        // Execute search
        const [products, totalCount] = await Promise.all([
            ProductModel.find(query)
                .populate('category subCategory')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            ProductModel.countDocuments(query)
        ]);

        console.log(`Found ${products.length} products matching criteria`);

        response.status(200).json({
            message: "Products search completed successfully",
            data: {
                products,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / limit),
                    totalItems: totalCount,
                    itemsPerPage: parseInt(limit)
                },
                filters: {
                    stockLevel,
                    categoryId,
                    search
                }
            },
            success: true
        });

    } catch (error) {
        console.error("Search products by stock error:", error);
        response.status(500).json({
            message: "Error searching products by stock",
            error: true,
            success: false
        });
    }
};
