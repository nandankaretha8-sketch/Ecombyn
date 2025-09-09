import express from 'express';
import auth from '../middleware/auth.js';
import {
  createReview,
  getProductReviews,
  getUserReviews,
  getReviewableProducts,
  updateReview,
  deleteReview,
  getReviewSettingsAPI,
  getAllReviewsForAdmin,
  approveReview,
  rejectReview
} from '../controllers/review.controller.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/settings', getReviewSettingsAPI);
router.get('/product/:productId', getProductReviews);

// All other routes require authentication
router.use(auth);

// Create a new review
router.post('/create', createReview);

// Get user's reviews
router.get('/user', getUserReviews);

// Get products available for review
router.get('/reviewable', getReviewableProducts);

// Update a review
router.put('/:reviewId', updateReview);

// Delete a review
router.delete('/:reviewId', deleteReview);

// Admin routes for review management
router.get('/admin/all', getAllReviewsForAdmin);
router.put('/admin/:reviewId/approve', approveReview);
router.put('/admin/:reviewId/reject', rejectReview);

export default router;
