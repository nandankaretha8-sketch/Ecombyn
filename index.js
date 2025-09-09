// Import models to ensure schemas are registered FIRST
import './models/user.model.js'
import './models/product.model.js'
import './models/orderV2.model.js'
import './models/review.model.js'
import './models/category.model.js'
import './models/subCategory.model.js'
import './models/cartproduct.model.js'
import './models/address.model.js'
import './models/coupon.model.js'
import './models/siteSettings.model.js'
import './models/wishlist.model.js'
import './models/banner.model.js'
import './models/visitor.model.js'
import './models/supportTicket.model.js'
import './models/inventory.model.js'
import './models/ugcVideo.model.js'
import './models/homeLayout.model.js'
import './models/pushSubscription.model.js'

// Force schema registration by importing the actual models
import UserModel from './models/user.model.js'
import ProductModel from './models/product.model.js'
import OrderV2Model from './models/orderV2.model.js'
import Review from './models/review.model.js'
import CategoryModel from './models/category.model.js'
import SubCategoryModel from './models/subCategory.model.js'
import CartProductModel from './models/cartproduct.model.js'
import AddressModel from './models/address.model.js'
import CouponModel from './models/coupon.model.js'
import SiteSettingsModel from './models/siteSettings.model.js'
import WishlistModel from './models/wishlist.model.js'
import BannerModel from './models/banner.model.js'
import VisitorModel from './models/visitor.model.js'
import SupportTicket from './models/supportTicket.model.js'
import InventoryModel from './models/inventory.model.js'
import UgcVideoModel from './models/ugcVideo.model.js'
import HomeLayoutModel from './models/homeLayout.model.js'
import PushSubscriptionModel from './models/pushSubscription.model.js'
import { fixPushSubscriptionIndexes } from './utils/pushIndexes.js'

// Import mongoose for model verification
import mongoose from 'mongoose'

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import xss from 'xss'
import mongoSanitize from 'express-mongo-sanitize'
import hpp from 'hpp'
import connectDB from './config/connectDB.js'
import userRouter from './route/user.route.js'
import categoryRouter from './route/category.route.js'
import uploadRouter from './route/upload.router.js'
import subCategoryRouter from './route/subCategory.route.js'
import productRouter from './route/product.route.js'
import cartRouter from './route/cart.route.js'
import addressRouter from './route/address.route.js'
import ordersRouter from './route/orders.route.js'
import couponRouter from './route/coupon.route.js'
import reviewRouter from './route/review.route.js'
import siteSettingsRouter from './route/siteSettings.route.js'
import wishlistRouter from './route/wishlist.route.js'
import analyticsRouter from './route/analytics.route.js'
import abandonedCartRouter from './route/abandonedCart.route.js'
import bannerRouter from './route/banner.route.js'
import visitorRouter from './route/visitor.route.js'
import supportRouter from './route/support.route.js'
import inventoryRouter from './route/inventory.js'
import ugcVideoRouter from './route/ugcVideo.route.js'
import homeLayoutRouter from './route/homeLayout.route.js'
import notificationsRouter from './route/notifications.route.js'

const app = express()

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'", process.env.FRONTEND_URL || "http://localhost:5173"],
            frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    }
}))

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // limit each IP to 10000 requests per windowMs (increased for testing)
    message: {
        error: true,
        message: 'Too many requests from this IP, please try again later.',
        success: false
    },
    standardHeaders: true,
    legacyHeaders: false,
})

// Apply rate limiting to all routes
app.use(limiter)

// More strict rate limiting for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // limit each IP to 500 requests per windowMs (increased for testing)
    message: {
        error: true,
        message: 'Too many authentication attempts, please try again later.',
        success: false
    },
    standardHeaders: true,
    legacyHeaders: false,
})

// CORS configuration
const allowedOrigins = [
    process.env.FRONTEND_URL || "http://localhost:5173",
    "http://localhost:5173",
    "http://localhost:3000",
    "https://your-frontend-domain.vercel.app", // Replace with your actual frontend domain
    "https://ecombyn-frontend.vercel.app" // Example frontend domain
];

app.use(cors({
    credentials: true,
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
}))

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Security middleware
app.use(mongoSanitize()) // Prevent NoSQL injection
app.use(hpp()) // Prevent HTTP Parameter Pollution

// Custom XSS protection middleware
app.use((req, res, next) => {
    if (req.body) {
        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                req.body[key] = xss(req.body[key])
            }
        })
    }
    next()
})

app.use(cookieParser())
app.use(morgan('combined'))

// Set fallback environment variables if not provided
process.env.SECRET_KEY_ACCESS_TOKEN = process.env.SECRET_KEY_ACCESS_TOKEN || "fallback-access-token-secret-key-32-chars"
process.env.SECRET_KEY_REFRESH_TOKEN = process.env.SECRET_KEY_REFRESH_TOKEN || "fallback-refresh-token-secret-key-32-chars"
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173"

const PORT = process.env.PORT || 8080

app.get("/",(request,response)=>{
    ///server to client
    response.json({
        message : "Server is running " + PORT
    })
})

// Routes
app.use('/api/user', authLimiter, userRouter)
app.use('/api/category', categoryRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/subcategory', subCategoryRouter)
app.use('/api/product', productRouter)
app.use('/api/cart', cartRouter)
app.use('/api/address', addressRouter)
app.use('/api/orders', ordersRouter)
app.use('/api/coupons', couponRouter)
app.use('/api/reviews', reviewRouter)
app.use('/api/site-settings', siteSettingsRouter)
app.use('/api/wishlist', wishlistRouter)
app.use('/api/analytics', analyticsRouter)
app.use('/api/abandoned-cart', abandonedCartRouter)
app.use('/api/banners', bannerRouter)
app.use('/api/visitors', visitorRouter)
app.use('/api/support', supportRouter)
app.use('/api/inventory', inventoryRouter)
app.use('/api/ugc-videos', ugcVideoRouter)
app.use('/api/home-layout', homeLayoutRouter)
app.use('/api/notifications', notificationsRouter)

// Global error handler
app.use((err, req, res, next) => {
    res.status(500).json({
        message: 'Something went wrong!',
        error: true,
        success: false
    })
})

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        message: 'Route not found',
        error: true,
        success: false
    })
})

// Initialize database connection and models
const initializeApp = async () => {
    try {
        // Connect to database
        await connectDB();
        
        // Verify that all models are properly registered
        console.log('Verifying model registration...');
        const models = [
            'User', 'Product', 'OrderV2', 'Review', 'Category', 'SubCategory',
            'CartProduct', 'Address', 'Coupon', 'SiteSettings', 'Wishlist',
            'Banner', 'Visitor', 'SupportTicket', 'Inventory', 'UgcVideo', 'HomeLayout', 'PushSubscription'
        ];
        
        models.forEach(modelName => {
            if (mongoose.models[modelName]) {
                console.log(`✅ ${modelName} model registered successfully`);
            } else {
                console.log(`❌ ${modelName} model NOT registered`);
            }
        });
        
        // Fix any legacy indexes for push subscriptions (safe idempotent)
        try {
            await fixPushSubscriptionIndexes(PushSubscriptionModel);
            console.log('Push subscription indexes verified.');
        } catch (e) {
            console.warn('Push subscription index check failed:', e?.message);
        }

        console.log('All models verified. App initialized successfully.');
        
    } catch (error) {
        console.error('Failed to initialize app:', error);
        throw error;
    }
};

// For Vercel serverless, we need to export the app and initialize on first request
let isInitialized = false;

// Initialize app on first request (lazy initialization)
const ensureInitialized = async () => {
    if (!isInitialized) {
        await initializeApp();
        isInitialized = true;
    }
};

// For local development, start the server
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
    initializeApp().then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    }).catch((error) => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });
}

// Export for Vercel serverless
export default async (req, res) => {
    try {
        await ensureInitialized();
        return app(req, res);
    } catch (error) {
        console.error('Serverless function error:', error);
        return res.status(500).json({
            message: 'Internal server error',
            error: true,
            success: false
        });
    }
};

