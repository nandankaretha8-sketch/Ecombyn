import CategoryModel from "../models/category.model.js";
import SubCategoryModel from "../models/subCategory.model.js";
import ProductModel from "../models/product.model.js";

export const AddCategoryController = async(request,response)=>{
    try {
        const { name , image, order } = request.body 

        if(!name || !image){
            return response.status(400).json({
                message : "Enter required fields",
                error : true,
                success : false
            })
        }

        const addCategory = new CategoryModel({
            name,
            image,
            order: order || 0
        })

        const saveCategory = await addCategory.save()

        if(!saveCategory){
            return response.status(500).json({
                message : "Not Created",
                error : true,
                success : false
            })
        }

        return response.json({
            message : "Add Category",
            data : saveCategory,
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

export const getCategoryController = async(request,response)=>{
    try {
        
        const data = await CategoryModel.find().sort({ order: 1, createdAt: -1 })

        return response.json({
            data : data,
            error : false,
            success : true
        })
    } catch (error) {
        return response.status(500).json({
            message : error.messsage || error,
            error : true,
            success : false
        })
    }
}

export const updateCategoryController = async(request,response)=>{
    try {
        const { _id ,name, image, order } = request.body 

        const update = await CategoryModel.updateOne({
            _id : _id
        },{
           name, 
           image,
           order: order || 0
        })

        return response.json({
            message : "Updated Category",
            success : true,
            error : false,
            data : update
        })
    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

export const deleteCategoryController = async(request,response)=>{
    try {
        const { _id } = request.body 

        const checkSubCategory = await SubCategoryModel.find({
            category : {
                "$in" : [ _id ]
            }
        }).countDocuments()

        const checkProduct = await ProductModel.find({
            category : {
                "$in" : [ _id ]
            }
        }).countDocuments()

        if(checkSubCategory >  0 || checkProduct > 0 ){
            return response.status(400).json({
                message : "Category is already use can't delete",
                error : true,
                success : false
            })
        }

        const deleteCategory = await CategoryModel.deleteOne({ _id : _id})

        return response.json({
            message : "Delete category successfully",
            data : deleteCategory,
            error : false,
            success : true
        })

    } catch (error) {
       return response.status(500).json({
            message : error.message || error,
            success : false,
            error : true
       }) 
    }
}

// Get products by category with pagination and search
export const getCategoryProductsController = async (request, response) => {
    try {
        const { categoryId, page = 1, limit = 20, search = "", includeAssigned = true, includeUnassigned = true } = request.body

        if (!categoryId) {
            return response.status(400).json({
                message: "Category ID is required",
                error: true,
                success: false
            })
        }

        const skip = (page - 1) * limit

        // Get category details
        const category = await CategoryModel.findById(categoryId)
        if (!category) {
            return response.status(404).json({
                message: "Category not found",
                error: true,
                success: false
            })
        }

        // Build search query
        let searchQuery = {}
        if (search) {
            searchQuery.name = { $regex: search, $options: 'i' }
        }

        // Get all products
        const allProducts = await ProductModel.find(searchQuery)
            .populate('category', 'name _id')
            .populate('subCategory', 'name _id')
            .lean()

        // Separate assigned and unassigned products
        const assignedProducts = allProducts.filter(product => 
            product.category.some(cat => cat._id.toString() === categoryId)
        )
        const unassignedProducts = allProducts.filter(product => 
            !product.category.some(cat => cat._id.toString() === categoryId)
        )

        // Combine based on include flags
        let filteredProducts = []
        if (includeAssigned && includeUnassigned) {
            filteredProducts = allProducts
        } else if (includeAssigned) {
            filteredProducts = assignedProducts
        } else if (includeUnassigned) {
            filteredProducts = unassignedProducts
        }

        // Apply pagination
        const totalProducts = filteredProducts.length
        const paginatedProducts = filteredProducts.slice(skip, skip + limit)

        // Add assignment status to each product
        const productsWithStatus = paginatedProducts.map(product => ({
            ...product,
            isAssigned: product.category.some(cat => cat._id.toString() === categoryId)
        }))

        return response.json({
            message: "Category products retrieved successfully",
            data: productsWithStatus,
            category: category,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalProducts / limit),
                totalProducts: totalProducts,
                hasNext: skip + limit < totalProducts,
                hasPrev: page > 1
            },
            summary: {
                assigned: assignedProducts.length,
                unassigned: unassignedProducts.length,
                total: allProducts.length
            },
            success: true,
            error: false
        })

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

// Bulk add products to category
export const bulkAddProductsToCategoryController = async (request, response) => {
    try {
        const { categoryId, productIds } = request.body

        if (!categoryId || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return response.status(400).json({
                message: "Category ID and product IDs array are required",
                error: true,
                success: false
            })
        }

        // Verify category exists
        const category = await CategoryModel.findById(categoryId)
        if (!category) {
            return response.status(404).json({
                message: "Category not found",
                error: true,
                success: false
            })
        }

        // Update products to add category
        const updateResult = await ProductModel.updateMany(
            { _id: { $in: productIds } },
            { $addToSet: { category: categoryId } }
        )

        if (updateResult.modifiedCount === 0) {
            return response.status(400).json({
                message: "No products were updated. They might already be assigned to this category.",
                error: true,
                success: false
            })
        }

        return response.json({
            message: `${updateResult.modifiedCount} products successfully added to category`,
            data: {
                categoryId,
                addedProducts: updateResult.modifiedCount,
                totalRequested: productIds.length
            },
            success: true,
            error: false
        })

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

// Bulk remove products from category
export const bulkRemoveProductsFromCategoryController = async (request, response) => {
    try {
        const { categoryId, productIds } = request.body

        if (!categoryId || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return response.status(400).json({
                message: "Category ID and product IDs array are required",
                error: true,
                success: false
            })
        }

        // Verify category exists
        const category = await CategoryModel.findById(categoryId)
        if (!category) {
            return response.status(404).json({
                message: "Category not found",
                error: true,
                success: false
            })
        }

        // Update products to remove category
        const updateResult = await ProductModel.updateMany(
            { _id: { $in: productIds } },
            { $pull: { category: categoryId } }
        )

        if (updateResult.modifiedCount === 0) {
            return response.status(400).json({
                message: "No products were updated. They might not be assigned to this category.",
                error: true,
                success: false
            })
        }

        return response.json({
            message: `${updateResult.modifiedCount} products successfully removed from category`,
            data: {
                categoryId,
                removedProducts: updateResult.modifiedCount,
                totalRequested: productIds.length
            },
            success: true,
            error: false
        })

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

// Toggle product assignment to category
export const toggleProductCategoryAssignmentController = async (request, response) => {
    try {
        const { categoryId, productId } = request.body

        if (!categoryId || !productId) {
            return response.status(400).json({
                message: "Category ID and product ID are required",
                error: true,
                success: false
            })
        }

        // Verify category exists
        const category = await CategoryModel.findById(categoryId)
        if (!category) {
            return response.status(404).json({
                message: "Category not found",
                error: true,
                success: false
            })
        }

        // Get product and check current assignment
        const product = await ProductModel.findById(productId)
        if (!product) {
            return response.status(404).json({
                message: "Product not found",
                error: true,
                success: false
            })
        }

        const isCurrentlyAssigned = product.category.some(cat => cat.toString() === categoryId)
        let updateOperation
        let message

        if (isCurrentlyAssigned) {
            // Remove from category
            updateOperation = { $pull: { category: categoryId } }
            message = "Product removed from category"
        } else {
            // Add to category
            updateOperation = { $addToSet: { category: categoryId } }
            message = "Product added to category"
        }

        const updatedProduct = await ProductModel.findByIdAndUpdate(
            productId,
            updateOperation,
            { new: true }
        ).populate('category', 'name _id')

        return response.json({
            message: message,
            data: {
                product: updatedProduct,
                isAssigned: !isCurrentlyAssigned
            },
            success: true,
            error: false
        })

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
}

// Reorder categories
export const reorderCategoriesController = async (request, response) => {
    try {
        const { categories } = request.body

        if (!Array.isArray(categories) || categories.length === 0) {
            return response.status(400).json({
                success: false,
                message: 'Categories array is required',
                error: true
            })
        }

        // Update each category's order
        const updatePromises = categories.map(({ id, order }) => 
            CategoryModel.findByIdAndUpdate(id, { order, updatedAt: Date.now() })
        )

        await Promise.all(updatePromises)

        response.status(200).json({
            success: true,
            message: 'Categories reordered successfully',
            error: false
        })
    } catch (error) {
        response.status(500).json({
            success: false,
            message: 'Error reordering categories',
            error: error.message
        })
    }
}