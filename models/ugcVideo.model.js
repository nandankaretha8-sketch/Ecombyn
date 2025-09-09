import mongoose from 'mongoose';

const ugcVideoSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Video title is required"],
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ""
    },
    originalUrl: {
        type: String,
        required: [true, "Original video URL is required"],
        trim: true
    },
    platform: {
        type: String,
        enum: ['youtube', 'instagram', 'tiktok'],
        required: true
    },
    videoId: {
        type: String,
        required: false
    },
    embedUrl: {
        type: String,
        required: false
    },
    thumbnail: {
        type: String,
        default: ""
    },
    creator: {
        type: String,
        default: "Customer"
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isApproved: {
        type: Boolean,
        default: false
    },
    displayOrder: {
        type: Number,
        default: 0
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        default: null
    },
    tags: [{
        type: String,
        trim: true
    }],
    views: {
        type: Number,
        default: 0
    },
    likes: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Indexes for better performance
ugcVideoSchema.index({ isActive: 1, isApproved: 1 });
ugcVideoSchema.index({ platform: 1 });
ugcVideoSchema.index({ category: 1 });
ugcVideoSchema.index({ displayOrder: 1 });

// Method to extract video ID and generate embed URL
ugcVideoSchema.methods.generateEmbedUrl = function() {
    const url = this.originalUrl;
    
    if (this.platform === 'youtube') {
        // Handle YouTube URLs (including Shorts)
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|shorts\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(youtubeRegex);
        if (match) {
            this.videoId = match[1];
            // Enhanced embed URL with aggressive overlay hiding
            const baseUrl = `https://www.youtube.com/embed/${this.videoId}`;
            const params = new URLSearchParams({
                autoplay: '1',
                loop: '1',
                playlist: this.videoId,
                mute: '1',
                controls: '0',
                showinfo: '0',
                rel: '0',
                modestbranding: '1',
                playsinline: '1',
                disablekb: '1',
                fs: '0',
                iv_load_policy: '3',
                cc_load_policy: '0',
                color: 'white',
                theme: 'light',
                enablejsapi: '1',
                origin: process.env.FRONTEND_URL || 'http://localhost:5173',
                // Additional parameters to hide YouTube branding
                autohide: '1',
                wmode: 'transparent',
                vq: 'hd720',
                hl: 'en',
                // Hide YouTube logo and watermark
                logo: '0',
                branding: '0'
            });
            this.embedUrl = `${baseUrl}?${params.toString()}`;
            this.thumbnail = `https://img.youtube.com/vi/${this.videoId}/maxresdefault.jpg`;
        }
    } else if (this.platform === 'instagram') {
        // Handle Instagram Reels URLs
        const instagramRegex = /instagram\.com\/reel\/([^\/\?]+)/;
        const match = url.match(instagramRegex);
        if (match) {
            this.videoId = match[1];
            this.embedUrl = `https://www.instagram.com/reel/${this.videoId}/embed/`;
        }
    } else if (this.platform === 'tiktok') {
        // Handle TikTok URLs
        const tiktokRegex = /tiktok\.com\/@[^\/]+\/video\/(\d+)/;
        const match = url.match(tiktokRegex);
        if (match) {
            this.videoId = match[1];
            this.embedUrl = `https://www.tiktok.com/embed/${this.videoId}`;
        }
    }
};

// Pre-save middleware to automatically generate embed URL
ugcVideoSchema.pre('save', function(next) {
    // Always generate embed URL on save
    this.generateEmbedUrl();
    
    // Validate that embedUrl was generated
    if (!this.embedUrl) {
        return next(new Error('Failed to generate embed URL from the provided video URL'));
    }
    
    next();
});

// Static method to detect platform from URL
ugcVideoSchema.statics.detectPlatform = function(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        return 'youtube';
    } else if (url.includes('instagram.com')) {
        return 'instagram';
    } else if (url.includes('tiktok.com')) {
        return 'tiktok';
    }
    return null;
};

const UGCVideoModel = mongoose.model('UgcVideo', ugcVideoSchema);

export default UGCVideoModel;
