import UGCVideoModel from '../models/ugcVideo.model.js';
import CategoryModel from '../models/category.model.js';
import ProductModel from '../models/product.model.js';

// Create new UGC video
export const createUGCVideo = async (req, res) => {
    try {
        const { title, description, originalUrl, creator, category, product, tags, displayOrder } = req.body;

        // Validate required fields
        if (!title || !originalUrl) {
            return res.status(400).json({
                success: false,
                message: "Title and video URL are required"
            });
        }

        // Detect platform from URL
        const platform = UGCVideoModel.detectPlatform(originalUrl);
        if (!platform) {
            return res.status(400).json({
                success: false,
                message: "Invalid video URL. Supported platforms: YouTube, Instagram, TikTok"
            });
        }

        // Validate category if provided
        if (category) {
            const categoryExists = await CategoryModel.findById(category);
            if (!categoryExists) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid category selected"
                });
            }
        }

        // Validate product if provided
        if (product) {
            const productExists = await ProductModel.findById(product);
            if (!productExists) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid product selected"
                });
            }
        }

        // Create video object
        const videoData = {
            title,
            description: description || "",
            originalUrl,
            platform,
            creator: creator || "Customer",
            category: category || null,
            product: product || null,
            tags: tags || [],
            displayOrder: displayOrder || 0,
            isApproved: true, // Auto-approve for admin
            isActive: true
        };

        const newVideo = new UGCVideoModel(videoData);
        await newVideo.save();

        res.status(201).json({
            success: true,
            message: "UGC video created successfully",
            data: newVideo
        });

    } catch (error) {
        console.error('Error creating UGC video:', error);
        res.status(500).json({
            success: false,
            message: "Failed to create UGC video",
            error: error.message
        });
    }
};

// Get all UGC videos (admin)
export const getAllUGCVideos = async (req, res) => {
    try {
        const { page = 1, limit = 10, platform, isApproved, category } = req.query;
        
        const query = {};
        
        if (platform) query.platform = platform;
        if (isApproved !== undefined) query.isApproved = isApproved === 'true';
        if (category) query.category = category;

        const videos = await UGCVideoModel.find(query)
            .populate('category', 'name')
            .populate('product', 'name price discount image')
            .sort({ displayOrder: 1, createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await UGCVideoModel.countDocuments(query);

        res.status(200).json({
            success: true,
            data: videos,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalVideos: total
            }
        });

    } catch (error) {
        console.error('Error fetching UGC videos:', error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch UGC videos",
            error: error.message
        });
    }
};

// Get approved UGC videos for home page
export const getApprovedUGCVideos = async (req, res) => {
    try {
        const { limit = 6 } = req.query;

        const videos = await UGCVideoModel.find({
            isActive: true,
            isApproved: true
        })
        .populate('category', 'name')
        .populate('product', 'name price discount image')
        .sort({ displayOrder: 1, createdAt: -1 })
        .limit(parseInt(limit))
        .exec();

        res.status(200).json({
            success: true,
            data: videos
        });

    } catch (error) {
        console.error('Error fetching approved UGC videos:', error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch UGC videos",
            error: error.message
        });
    }
};

// Update UGC video
export const updateUGCVideo = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // If URL is being updated, detect platform
        if (updateData.originalUrl) {
            const platform = UGCVideoModel.detectPlatform(updateData.originalUrl);
            if (!platform) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid video URL. Supported platforms: YouTube, Instagram, TikTok"
                });
            }
            updateData.platform = platform;
        }

        const updatedVideo = await UGCVideoModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('category', 'name').populate('product', 'name price discount image');

        if (!updatedVideo) {
            return res.status(404).json({
                success: false,
                message: "UGC video not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "UGC video updated successfully",
            data: updatedVideo
        });

    } catch (error) {
        console.error('Error updating UGC video:', error);
        res.status(500).json({
            success: false,
            message: "Failed to update UGC video",
            error: error.message
        });
    }
};

// Delete UGC video
export const deleteUGCVideo = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedVideo = await UGCVideoModel.findByIdAndDelete(id);

        if (!deletedVideo) {
            return res.status(404).json({
                success: false,
                message: "UGC video not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "UGC video deleted successfully"
        });

    } catch (error) {
        console.error('Error deleting UGC video:', error);
        res.status(500).json({
            success: false,
            message: "Failed to delete UGC video",
            error: error.message
        });
    }
};

// Toggle video approval status
export const toggleVideoApproval = async (req, res) => {
    try {
        const { id } = req.params;

        const video = await UGCVideoModel.findById(id);
        if (!video) {
            return res.status(404).json({
                success: false,
                message: "UGC video not found"
            });
        }

        video.isApproved = !video.isApproved;
        await video.save();

        res.status(200).json({
            success: true,
            message: `Video ${video.isApproved ? 'approved' : 'unapproved'} successfully`,
            data: video
        });

    } catch (error) {
        console.error('Error toggling video approval:', error);
        res.status(500).json({
            success: false,
            message: "Failed to toggle video approval",
            error: error.message
        });
    }
};

// Get video by ID
export const getUGCVideoById = async (req, res) => {
    try {
        const { id } = req.params;

        const video = await UGCVideoModel.findById(id)
            .populate('category', 'name')
            .populate('product', 'name price discount image');

        if (!video) {
            return res.status(404).json({
                success: false,
                message: "UGC video not found"
            });
        }

        res.status(200).json({
            success: true,
            data: video
        });

    } catch (error) {
        console.error('Error fetching UGC video:', error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch UGC video",
            error: error.message
        });
    }
};

// Assign product to UGC video
export const assignProductToVideo = async (req, res) => {
    try {
        const { id } = req.params;
        const { productId } = req.body;

        // Validate product exists
        if (productId) {
            const productExists = await ProductModel.findById(productId);
            if (!productExists) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid product selected"
                });
            }
        }

        const updatedVideo = await UGCVideoModel.findByIdAndUpdate(
            id,
            { product: productId || null },
            { new: true, runValidators: true }
        ).populate('category', 'name').populate('product', 'name price discount image');

        if (!updatedVideo) {
            return res.status(404).json({
                success: false,
                message: "UGC video not found"
            });
        }

        res.status(200).json({
            success: true,
            message: productId ? "Product assigned successfully" : "Product removed successfully",
            data: updatedVideo
        });

    } catch (error) {
        console.error('Error assigning product to video:', error);
        res.status(500).json({
            success: false,
            message: "Failed to assign product to video",
            error: error.message
        });
    }
};
