import express from "express";
import auth from "../middleware/auth.js";
import { admin } from "../middleware/Admin.js";
import {
    getDashboardAnalytics,
    getRevenueAnalytics,
    getCustomerAnalytics,
    getProductAnalytics,
    getAbandonedCartAnalytics
} from "../controllers/analytics.controller.js";

const router = express.Router();

// All analytics routes require admin authentication
router.use(auth, admin);

// GET /api/analytics/dashboard - Get comprehensive dashboard analytics
router.get('/dashboard', getDashboardAnalytics);

// GET /api/analytics/revenue - Get detailed revenue analytics
router.get('/revenue', getRevenueAnalytics);

// GET /api/analytics/customers - Get customer analytics
router.get('/customers', getCustomerAnalytics);

// GET /api/analytics/products - Get product analytics
router.get('/products', getProductAnalytics);

// GET /api/analytics/abandoned-carts - Get abandoned cart analytics
router.get('/abandoned-carts', getAbandonedCartAnalytics);

export default router;
