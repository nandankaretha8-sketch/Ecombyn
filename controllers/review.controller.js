import Review from '../models/review.model.js';
import ProductModel from '../models/product.model.js';
import OrderV2Model from '../models/orderV2.model.js';
import SiteSettingsModel from '../models/siteSettings.model.js';
import { uploadImageCloudinary } from '../utils/cloudinary.js';

// Helper function to check if reviews are enabled
const checkReviewsEnabled = async () => {
  try {
    const settings = await SiteSettingsModel.findOne();
    return settings?.reviewSettings?.isEnabled !== false; // Default to true if not set
  } catch (error) {
    console.error('Error checking review settings:', error);
    return true; // Default to true on error
  }
};

// Helper function to get review settings
const getReviewSettings = async () => {
  try {
    const settings = await SiteSettingsModel.findOne();
    return settings?.reviewSettings || {
      isEnabled: true,
      allowGuestReviews: false,
      requirePurchase: true,
      autoApprove: false,
      maxImagesPerReview: 3,
      maxReviewLength: 1000
    };
  } catch (error) {
    console.error('Error getting review settings:', error);
    return {
      isEnabled: true,
      allowGuestReviews: false,
      requirePurchase: true,
      autoApprove: false,
      maxImagesPerReview: 3,
      maxReviewLength: 1000
    };
  }
};

// Create a new review
export const createReview = async (req, res) => {
  try {
    // Get review settings
    const reviewSettings = await getReviewSettings();
    
    // Check if reviews are enabled
    if (!reviewSettings.isEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Review system is currently disabled'
      });
    }

    const { productId, orderId, rating, comment, images } = req.body;
    const userId = req.userId;

    // Validate required fields
    if (!productId || !orderId || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate rating range
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Validate comment length based on settings
    if (comment.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Comment must be at least 10 characters long'
      });
    }

    if (comment.trim().length > reviewSettings.maxReviewLength) {
      return res.status(400).json({
        success: false,
        message: `Comment must not exceed ${reviewSettings.maxReviewLength} characters`
      });
    }

    // Validate image count based on settings
    if (images && images.length > reviewSettings.maxImagesPerReview) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${reviewSettings.maxImagesPerReview} images allowed per review`
      });
    }

    // Check if order exists and belongs to user
    const order = await OrderV2Model.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    console.log('Order found:', {
      orderId: order._id,
      userId: order.user.toString(),
      requestUserId: userId,
      orderStatus: order.orderStatus,
      orderItems: order.orderItems.map(item => ({
        productId: item.product.toString(),
        requestedProductId: productId
      }))
    });

    if (order.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only review your own orders'
      });
    }

    // Check if order is delivered
    if (order.orderStatus !== 'Delivered') {
      console.log('Order status check failed:', {
        orderStatus: order.orderStatus,
        expected: 'Delivered',
        match: order.orderStatus === 'Delivered'
      });
      return res.status(400).json({
        success: false,
        message: 'You can only review delivered orders'
      });
    }

    // Check if product exists in order
    const orderItem = order.orderItems.find(item => 
      item.product.toString() === productId
    );
    
    if (!orderItem) {
      return res.status(400).json({
        success: false,
        message: 'Product not found in this order'
      });
    }

    // Check if review already exists for this specific order
    const existingReview = await Review.findOne({
      user: userId,
      product: productId,
      order: orderId
    });

    console.log('Duplicate review check:', {
      userId,
      productId,
      orderId,
      existingReview: existingReview ? existingReview._id : null
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product for this order'
      });
    }

    // Allow multiple reviews for the same product from different orders
    // This enables users to review the same product multiple times if they order it again

    // Handle image uploads if provided
    let uploadedImages = [];
    if (images && images.length > 0) {
      try {
        for (const image of images) {
          if (image.startsWith('data:image')) {
            const result = await uploadImageCloudinary(image, 'reviews');
            uploadedImages.push({
              url: result.secure_url,
              publicId: result.public_id
            });
          }
        }
      } catch (imageError) {
        console.error('Image upload error:', imageError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload images'
        });
      }
    }

    // Determine approval status based on settings
    const isAutoApproved = reviewSettings.autoApprove;
    const reviewStatus = isAutoApproved ? 'approved' : 'pending';
    const isApproved = isAutoApproved;

    // Create the review
    const review = new Review({
      user: userId,
      product: productId,
      order: orderId,
      rating,
      comment: comment.trim(),
      images: uploadedImages,
      isApproved,
      status: reviewStatus,
      approvedBy: isAutoApproved ? userId : null,
      approvedAt: isAutoApproved ? new Date() : null
    });

    await review.save();

    // Update product stats
    const productStats = await Review.calculateProductStats(productId);
            await ProductModel.findByIdAndUpdate(productId, {
      averageRating: productStats.averageRating,
      totalReviews: productStats.totalReviews
    });

    // Populate user details for response
    await review.populate('user', 'name email');

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: review
    });

  } catch (error) {
    console.error('Create review error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product for this order'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to submit review',
      error: error.message
    });
  }
};

// Get reviews for a specific product
export const getProductReviews = async (req, res) => {
  try {
    // Check if reviews are enabled
    const reviewsEnabled = await checkReviewsEnabled();
    if (!reviewsEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Review system is currently disabled'
      });
    }

    const { productId } = req.params;
    const { page = 1, limit = 10, rating } = req.query;

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build query - only show approved reviews to public
    let query = { 
      product: productId,
      isApproved: true,
      status: 'approved'
    };
    if (rating && rating !== 'all') {
      query.rating = parseInt(rating);
    }

    // Get reviews with pagination
    const reviews = await Review.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalReviews = await Review.countDocuments(query);
    const totalPages = Math.ceil(totalReviews / parseInt(limit));

    // Get product stats
    const productStats = await Review.calculateProductStats(productId);

    res.json({
      success: true,
      data: {
        reviews,
        ratingStats: productStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalReviews,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get product reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
      error: error.message
    });
  }
};

// Get user's reviews
export const getUserReviews = async (req, res) => {
  try {
    // Check if reviews are enabled
    const reviewsEnabled = await checkReviewsEnabled();
    if (!reviewsEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Review system is currently disabled'
      });
    }

    const userId = req.userId;
    const { page = 1, limit = 10 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get user's reviews with safe populate
    const reviews = await Review.find({ user: userId })
      .populate('product', 'name image price')
      .populate('order', 'orderNumber orderStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(); // Use lean() for better performance

    // Get total count
    const totalReviews = await Review.countDocuments({ user: userId });
    const totalPages = Math.ceil(totalReviews / parseInt(limit));

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalReviews,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user reviews',
      error: error.message
    });
  }
};

// Get products available for review
export const getReviewableProducts = async (req, res) => {
  try {
    // Check if reviews are enabled
    const reviewsEnabled = await checkReviewsEnabled();
    if (!reviewsEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Review system is currently disabled'
      });
    }

    const userId = req.userId;
    const { page = 1, limit = 10 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Find delivered orders for the user
    const deliveredOrders = await OrderV2Model.find({
      user: userId,
      orderStatus: 'Delivered'
    }).populate('orderItems.product', 'name image price');

    // Get products that have already been reviewed for each specific order
    const reviewedOrderProducts = await Review.find({ user: userId })
      .select('product order');

    const reviewableProducts = [];
    const processedOrderProducts = new Set();

    for (const order of deliveredOrders) {
      for (const item of order.orderItems) {
        const productId = item.product._id.toString();
        const orderId = order._id.toString();
        
        // Check if this specific product-order combination has already been reviewed
        const alreadyReviewed = reviewedOrderProducts.some(review => 
          review.product.toString() === productId && 
          review.order.toString() === orderId
        );
        
        if (!alreadyReviewed && !processedOrderProducts.has(`${productId}-${orderId}`)) {
          reviewableProducts.push({
            product: item.product,
            orderId: order._id,
            orderDate: order.createdAt
          });
          processedOrderProducts.add(`${productId}-${orderId}`);
        }
      }
    }

    // Apply pagination
    const totalProducts = reviewableProducts.length;
    const totalPages = Math.ceil(totalProducts / parseInt(limit));
    const paginatedProducts = reviewableProducts.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: {
        products: paginatedProducts,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalProducts,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get reviewable products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviewable products',
      error: error.message
    });
  }
};

// Update a review
export const updateReview = async (req, res) => {
  try {
    // Check if reviews are enabled
    const reviewsEnabled = await checkReviewsEnabled();
    if (!reviewsEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Review system is currently disabled'
      });
    }

    const { reviewId } = req.params;
    const { rating, comment, images } = req.body;
    const userId = req.userId;

    if (!rating && !comment && !images) {
      return res.status(400).json({
        success: false,
        message: 'At least one field must be provided for update'
      });
    }

    // Find the review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns the review
    if (review.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own reviews'
      });
    }

    // Update fields
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Rating must be between 1 and 5'
        });
      }
      review.rating = rating;
    }

    if (comment !== undefined) {
      if (comment.trim().length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Comment must be at least 10 characters long'
        });
      }
      review.comment = comment.trim();
    }

    if (images !== undefined) {
      // Handle image updates
      let uploadedImages = [];
      if (images.length > 0) {
        try {
          for (const image of images) {
            if (image.startsWith('data:image')) {
              const result = await uploadImageCloudinary(image, 'reviews');
              uploadedImages.push({
                url: result.secure_url,
                publicId: result.public_id
              });
            }
          }
        } catch (imageError) {
          console.error('Image upload error:', imageError);
          return res.status(500).json({
            success: false,
            message: 'Failed to upload images'
          });
        }
      }
      review.images = uploadedImages;
    }

    await review.save();

    // Update product stats
    const productStats = await Review.calculateProductStats(review.product);
    await ProductModel.findByIdAndUpdate(review.product, {
      averageRating: productStats.averageRating,
      totalReviews: productStats.totalReviews
    });

    // Populate user details for response
    await review.populate('user', 'name email');

    res.json({
      success: true,
      message: 'Review updated successfully',
      data: review
    });

  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update review',
      error: error.message
    });
  }
};

// Delete a review
export const deleteReview = async (req, res) => {
  try {
    // Check if reviews are enabled
    const reviewsEnabled = await checkReviewsEnabled();
    if (!reviewsEnabled) {
      return res.status(403).json({
        success: false,
        message: 'Review system is currently disabled'
      });
    }

    const { reviewId } = req.params;
    const userId = req.userId;

    // Find the review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if user owns the review
    if (review.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own reviews'
      });
    }

    // Delete the review
    await Review.findByIdAndDelete(reviewId);

    // Update product stats
    const productStats = await Review.calculateProductStats(review.product);
    await ProductModel.findByIdAndUpdate(review.product, {
      averageRating: productStats.averageRating,
      totalReviews: productStats.totalReviews
    });

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });

  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete review',
      error: error.message
    });
  }
};

// Get review settings
export const getReviewSettingsAPI = async (req, res) => {
  try {
    const settings = await getReviewSettings();
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Get review settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch review settings',
      error: error.message
    });
  }
};

// Get all reviews for admin (including pending, approved, rejected)
export const getAllReviewsForAdmin = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, productId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (productId) {
      query.product = productId;
    }

    // Get reviews with pagination
    const reviews = await Review.find(query)
      .populate('user', 'name email')
      .populate('product', 'name image')
      .populate('order', 'orderNumber')
      .populate('approvedBy', 'name')
      .populate('rejectedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const totalReviews = await Review.countDocuments(query);
    const totalPages = Math.ceil(totalReviews / parseInt(limit));

    // Get status counts
    const statusCounts = await Review.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const statusStats = {
      pending: 0,
      approved: 0,
      rejected: 0
    };

    statusCounts.forEach(stat => {
      statusStats[stat._id] = stat.count;
    });

    res.json({
      success: true,
      data: {
        reviews,
        statusStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalReviews,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Get all reviews for admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews',
      error: error.message
    });
  }
};

// Approve a review
export const approveReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const adminId = req.userId;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Update review status
    review.isApproved = true;
    review.status = 'approved';
    review.approvedBy = adminId;
    review.approvedAt = new Date();
    review.rejectedBy = null;
    review.rejectedAt = null;
    review.rejectionReason = null;

    await review.save();

    // Update product stats
    const productStats = await Review.calculateProductStats(review.product);
    await ProductModel.findByIdAndUpdate(review.product, {
      averageRating: productStats.averageRating,
      totalReviews: productStats.totalReviews
    });

    // Populate for response
    await review.populate('user', 'name email');
    await review.populate('product', 'name image');
    await review.populate('approvedBy', 'name');

    res.json({
      success: true,
      message: 'Review approved successfully',
      data: review
    });

  } catch (error) {
    console.error('Approve review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve review',
      error: error.message
    });
  }
};

// Reject a review
export const rejectReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reason } = req.body;
    const adminId = req.userId;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Update review status
    review.isApproved = false;
    review.status = 'rejected';
    review.rejectedBy = adminId;
    review.rejectedAt = new Date();
    review.rejectionReason = reason || 'Review rejected by admin';
    review.approvedBy = null;
    review.approvedAt = null;

    await review.save();

    // Update product stats (remove this review from stats)
    const productStats = await Review.calculateProductStats(review.product);
    await ProductModel.findByIdAndUpdate(review.product, {
      averageRating: productStats.averageRating,
      totalReviews: productStats.totalReviews
    });

    // Populate for response
    await review.populate('user', 'name email');
    await review.populate('product', 'name image');
    await review.populate('rejectedBy', 'name');

    res.json({
      success: true,
      message: 'Review rejected successfully',
      data: review
    });

  } catch (error) {
    console.error('Reject review error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject review',
      error: error.message
    });
  }
};
