import express from "express";
import {
    getInventoryAnalyticsController,
    getLowStockProductsController,
    getOutOfStockProductsController,
    getInventoryOverviewController,
    getProductStockDetailsController,
    searchProductsByStockController
} from "../controllers/inventory.controller.js";
import auth from "../middleware/auth.js";
import { admin as isAdmin } from "../middleware/Admin.js";

const router = express.Router();

// Get inventory analytics (Admin only)
router.get("/analytics", auth, isAdmin, getInventoryAnalyticsController);

// Get low stock products (Admin only)
router.get("/low-stock", auth, isAdmin, getLowStockProductsController);

// Get out of stock products (Admin only)
router.get("/out-of-stock", auth, isAdmin, getOutOfStockProductsController);

// Get inventory overview (Admin only)
router.get("/overview", auth, isAdmin, getInventoryOverviewController);

// Get product stock details (Admin only)
router.get("/product/:productId/stock", auth, isAdmin, getProductStockDetailsController);

// Search products by stock criteria (Admin only)
router.get("/search", auth, isAdmin, searchProductsByStockController);

export default router;
