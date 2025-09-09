import { Router } from 'express'
import auth from '../middleware/auth.js'
import { 
    AddCategoryController, 
    deleteCategoryController, 
    getCategoryController, 
    updateCategoryController,
    getCategoryProductsController,
    bulkAddProductsToCategoryController,
    bulkRemoveProductsFromCategoryController,
    toggleProductCategoryAssignmentController,
    reorderCategoriesController
} from '../controllers/category.controller.js'
import { admin } from '../middleware/Admin.js'

const categoryRouter = Router()

categoryRouter.post("/add-category",auth,AddCategoryController)
categoryRouter.get('/get',getCategoryController)
categoryRouter.put('/update',auth,updateCategoryController)
categoryRouter.delete("/delete",auth,deleteCategoryController)

// Category Product Management Routes
categoryRouter.post("/products", auth, admin, getCategoryProductsController)
categoryRouter.post("/bulk-add-products", auth, admin, bulkAddProductsToCategoryController)
categoryRouter.post("/bulk-remove-products", auth, admin, bulkRemoveProductsFromCategoryController)
categoryRouter.post("/toggle-product", auth, admin, toggleProductCategoryAssignmentController)

// Category Reordering Route
categoryRouter.put("/reorder", auth, admin, reorderCategoriesController)

export default categoryRouter