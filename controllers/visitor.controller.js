import VisitorModel from "../models/visitor.model.js";

/**
 * Track visitor activity
 */
// Helper function to get client IP address
const getClientIP = (req) => {
    // Check various headers for IP address (in order of preference)
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIP = req.headers['x-real-ip'];
    const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
    const xClientIP = req.headers['x-client-ip'];
    
    // If x-forwarded-for exists, get the first IP (client IP)
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    
    // Check other headers
    if (realIP) return realIP;
    if (cfConnectingIP) return cfConnectingIP;
    if (xClientIP) return xClientIP;
    
    // Fallback to connection info
    return req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.ip || 
           '127.0.0.1'; // Default to localhost for development
};

export const trackVisitor = async (req, res) => {
    try {
        const ipAddress = getClientIP(req);
        const userAgent = req.body.userAgent || req.headers['user-agent'] || '';
        const page = req.body.page || req.query.page || '/';
        const referrer = req.body.referrer || req.headers.referer || req.headers.referrer || '';
        const language = req.body.language || req.headers['accept-language'] || '';
        const timezone = req.body.timezone || '';

        // Validate required fields
        if (!ipAddress || ipAddress === 'unknown') {
            return res.status(400).json({
                success: false,
                message: 'Invalid IP address'
            });
        }


        // Track the visitor with enhanced data
        const trackedVisitor = await VisitorModel.trackVisitor(ipAddress, userAgent, page, referrer, language, timezone);


        // Optimized response for production
        res.json({
            success: true,
            message: 'Visitor tracked successfully'
        });
    } catch (error) {
        console.error('Visitor tracking error:', error);
        
        
        res.status(500).json({
            success: false,
            message: 'Failed to track visitor'
        });
    }
};

/**
 * Get visitor analytics for admin dashboard
 */
export const getVisitorAnalytics = async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        
        // Calculate date range
        const now = new Date();
        let startDate = new Date();
        
        switch (period) {
            case 'today':
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'week':
                startDate.setDate(now.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(now.getMonth() - 1);
                break;
            case 'quarter':
                startDate.setMonth(now.getMonth() - 3);
                break;
            case 'year':
                startDate.setFullYear(now.getFullYear() - 1);
                break;
            default:
                startDate.setMonth(now.getMonth() - 1);
        }

        // Get previous period for comparison
        const previousStartDate = new Date(startDate);
        const previousEndDate = new Date(now);
        const periodDiff = now.getTime() - startDate.getTime();
        previousStartDate.setTime(previousStartDate.getTime() - periodDiff);
        previousEndDate.setTime(previousEndDate.getTime() - periodDiff);

        // Get current period data
        const [currentTotalVisitors, currentUniqueVisitors, currentLiveVisitors] = await Promise.all([
            VisitorModel.getVisitorsByDateRange(startDate, now),
            VisitorModel.getUniqueVisitorsByDateRange(startDate, now).then(ips => ips.length),
            VisitorModel.getLiveVisitors()
        ]);


        // Get previous period data
        const [previousTotalVisitors, previousUniqueVisitors] = await Promise.all([
            VisitorModel.getVisitorsByDateRange(previousStartDate, previousEndDate),
            VisitorModel.getUniqueVisitorsByDateRange(previousStartDate, previousEndDate).then(ips => ips.length)
        ]);

        // Calculate growth percentages
        const totalVisitorsGrowth = previousTotalVisitors > 0 
            ? ((currentTotalVisitors - previousTotalVisitors) / previousTotalVisitors) * 100 
            : currentTotalVisitors > 0 ? 100 : 0;

        const uniqueVisitorsGrowth = previousUniqueVisitors > 0 
            ? ((currentUniqueVisitors - previousUniqueVisitors) / previousUniqueVisitors) * 100 
            : currentUniqueVisitors > 0 ? 100 : 0;

        // Get all-time totals
        const allTimeTotalVisitors = await VisitorModel.getTotalVisitors();

        // Get daily visitor trend for the current period
        const dailyTrend = await VisitorModel.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: now }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    visitors: { $sum: 1 },
                    uniqueVisitors: { $addToSet: "$ipAddress" }
                }
            },
            {
                $project: {
                    date: "$_id",
                    visitors: 1,
                    uniqueVisitors: { $size: "$uniqueVisitors" }
                }
            },
            {
                $sort: { date: 1 }
            }
        ]);

        // Get top pages visited
        const topPages = await VisitorModel.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: now }
                }
            },
            {
                $group: {
                    _id: "$page",
                    visits: { $sum: 1 },
                    uniqueVisitors: { $addToSet: "$ipAddress" }
                }
            },
            {
                $project: {
                    page: "$_id",
                    visits: 1,
                    uniqueVisitors: { $size: "$uniqueVisitors" }
                }
            },
            {
                $sort: { visits: -1 }
            },
            {
                $limit: 10
            }
        ]);

        res.json({
            success: true,
            data: {
                current: {
                    totalVisitors: currentTotalVisitors,
                    uniqueVisitors: currentUniqueVisitors,
                    liveVisitors: currentLiveVisitors
                },
                previous: {
                    totalVisitors: previousTotalVisitors,
                    uniqueVisitors: previousUniqueVisitors
                },
                growth: {
                    totalVisitors: {
                        percentage: Math.round(totalVisitorsGrowth * 10) / 10,
                        trend: totalVisitorsGrowth >= 0 ? 'up' : 'down'
                    },
                    uniqueVisitors: {
                        percentage: Math.round(uniqueVisitorsGrowth * 10) / 10,
                        trend: uniqueVisitorsGrowth >= 0 ? 'up' : 'down'
                    }
                },
                allTime: {
                    totalVisitors: allTimeTotalVisitors
                },
                dailyTrend,
                topPages
            }
        });
    } catch (error) {
        console.error('Visitor analytics error:', error);
        
        // Return appropriate error response
        res.status(500).json({
            success: false,
            message: 'Failed to fetch visitor analytics'
        });
    }
};


/**
 * Clean up old inactive visitors (cron job endpoint)
 */
export const cleanInactiveVisitors = async (req, res) => {
    try {
        const result = await VisitorModel.cleanInactiveVisitors();
        
        res.json({
            success: true,
            message: 'Inactive visitors cleaned successfully',
            data: result
        });
    } catch (error) {
        console.error('Clean inactive visitors error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Failed to clean inactive visitors'
        });
    }
};
