import express from 'express';
import { trackVisitor, getVisitorAnalytics, cleanInactiveVisitors } from '../controllers/visitor.controller.js';
import auth from '../middleware/auth.js';
import { admin } from '../middleware/Admin.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiting for visitor tracking (production protection)
const trackingLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // Limit each IP to 30 requests per windowMs
    message: {
        success: false,
        message: 'Too many tracking requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting in development
    skip: (req) => process.env.NODE_ENV === 'development'
});

// Track visitor (public endpoint with rate limiting)
router.post('/track', trackingLimiter, trackVisitor);

// Get visitor analytics (admin only)
router.get('/analytics', auth, admin, getVisitorAnalytics);

// Clean inactive visitors (admin only)
router.post('/clean', auth, admin, cleanInactiveVisitors);

export default router;
