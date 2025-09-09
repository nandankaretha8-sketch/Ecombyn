import mongoose from "mongoose";

const visitorSchema = new mongoose.Schema({
    ipAddress: {
        type: String,
        required: true,
        index: true
    },
    userAgent: {
        type: String,
        default: ""
    },
    page: {
        type: String,
        default: "/"
    },
    referrer: {
        type: String,
        default: ""
    },
    language: {
        type: String,
        default: ""
    },
    timezone: {
        type: String,
        default: ""
    },
    country: {
        type: String,
        default: ""
    },
    city: {
        type: String,
        default: ""
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    visitCount: {
        type: Number,
        default: 1
    },
    firstVisit: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for efficient queries
visitorSchema.index({ ipAddress: 1, lastActivity: -1 });
visitorSchema.index({ lastActivity: -1 });
visitorSchema.index({ createdAt: -1 });

// Static method to get total visitors
visitorSchema.statics.getTotalVisitors = function() {
    return this.countDocuments();
};

// Static method to get live visitors (active in last 5 minutes)
visitorSchema.statics.getLiveVisitors = function() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.countDocuments({
        lastActivity: { $gte: fiveMinutesAgo }
    });
};

// Static method to get visitors by date range
visitorSchema.statics.getVisitorsByDateRange = function(startDate, endDate) {
    return this.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate }
    });
};

// Static method to get unique visitors by date range
visitorSchema.statics.getUniqueVisitorsByDateRange = function(startDate, endDate) {
    return this.distinct('ipAddress', {
        createdAt: { $gte: startDate, $lte: endDate }
    });
};

// Static method to track or update visitor
visitorSchema.statics.trackVisitor = async function(ipAddress, userAgent = "", page = "/", referrer = "", language = "", timezone = "") {
    try {
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        
        // Validate input parameters
        if (!ipAddress || ipAddress === 'unknown') {
            throw new Error('Invalid IP address provided');
        }
        
        // Try to find existing active visitor
        let visitor = await this.findOne({
            ipAddress,
            lastActivity: { $gte: fiveMinutesAgo }
        });
        
        if (visitor) {
            // Update existing visitor
            visitor.lastActivity = now;
            visitor.page = page;
            visitor.referrer = referrer;
            visitor.visitCount += 1;
            
            // Update language and timezone if provided
            if (language) visitor.language = language;
            if (timezone) visitor.timezone = timezone;
            
            await visitor.save();
            
        } else {
            // Create new visitor
            visitor = new this({
                ipAddress,
                userAgent,
                page,
                referrer,
                language,
                timezone,
                lastActivity: now
            });
            await visitor.save();
            
        }
        
        return visitor;
    } catch (error) {
        console.error('Error in trackVisitor:', error);
        throw error; // Re-throw to be handled by controller
    }
};

// Static method to clean old inactive visitors (older than 1 hour)
visitorSchema.statics.cleanInactiveVisitors = async function() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.updateMany(
        { lastActivity: { $lt: oneHourAgo } },
        { isActive: false }
    );
};

export default mongoose.model("Visitor", visitorSchema);
