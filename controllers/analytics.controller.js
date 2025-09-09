import OrderV2Model from "../models/orderV2.model.js";
import UserModel from "../models/user.model.js";
import ProductModel from "../models/product.model.js";
import CouponModel from "../models/coupon.model.js";

import CartProductModel from "../models/cartproduct.model.js";
import VisitorModel from "../models/visitor.model.js";
import SiteSettingsModel from "../models/siteSettings.model.js";
import mongoose from "mongoose";

/**
 * Analytics Controller
 * Provides comprehensive business analytics for admin dashboard
 */

// Helper function to get date range
const getDateRange = (period, customDates = null) => {
    const now = new Date();
    const startDate = new Date();
    
    // Handle custom date range
    if (customDates && customDates.startDate && customDates.endDate) {
        const customStartDate = new Date(customDates.startDate);
        const customEndDate = new Date(customDates.endDate);
        
        // Set end date to end of day for better inclusivity
        customEndDate.setHours(23, 59, 59, 999);
        
        return { startDate: customStartDate, endDate: customEndDate };
    }
    
    // Handle predefined periods
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
            startDate.setMonth(now.getMonth() - 1); // Default to last month
    }
    
    return { startDate, endDate: now };
};

// Helper function to format currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

// Helper function to calculate percentage change
const calculatePercentageChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
};

/**
 * Get comprehensive dashboard analytics
 */
export const getDashboardAnalytics = async (req, res) => {
    try {
        const { period = 'month', customDates, startDate: customStartDate, endDate: customEndDate } = req.query;
        
        // Validate custom date range if provided
        if (customDates === 'true') {
            if (!customStartDate || !customEndDate) {
                return res.status(400).json({
                    success: false,
                    error: true,
                    message: 'Both start date and end date are required for custom date range'
                });
            }
            
            const startDate = new Date(customStartDate);
            const endDate = new Date(customEndDate);
            
            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    error: true,
                    message: 'Invalid date format provided'
                });
            }
            
            if (startDate > endDate) {
                return res.status(400).json({
                    success: false,
                    error: true,
                    message: 'Start date cannot be after end date'
                });
            }
            
            const diffTime = Math.abs(endDate - startDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays > 365) {
                return res.status(400).json({
                    success: false,
                    error: true,
                    message: 'Date range cannot exceed 1 year'
                });
            }
        }
        
        // Handle custom date range
        let dateRange;
        if (customDates === 'true' && customStartDate && customEndDate) {
            dateRange = getDateRange(period, { startDate: customStartDate, endDate: customEndDate });
        } else {
            dateRange = getDateRange(period);
        }
        
        const { startDate, endDate } = dateRange;
        
        // Get previous period for comparison
        const previousStartDate = new Date(startDate);
        const previousEndDate = new Date(endDate);
        const periodDiff = endDate.getTime() - startDate.getTime();
        previousStartDate.setTime(previousStartDate.getTime() - periodDiff);
        previousEndDate.setTime(previousEndDate.getTime() - periodDiff);
        
        // For custom date ranges, limit the previous period to avoid going too far back
        if (customDates === 'true') {
            const maxPreviousStart = new Date();
            maxPreviousStart.setFullYear(maxPreviousStart.getFullYear() - 2); // Limit to 2 years back
            if (previousStartDate < maxPreviousStart) {
                previousStartDate.setTime(maxPreviousStart.getTime());
            }
        }

        // Revenue Analytics
        const [currentRevenue, previousRevenue] = await Promise.all([
            // Current period revenue
            OrderV2Model.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate },
                        orderStatus: { $ne: 'Cancelled' },
                        paymentStatus: { $in: ['Paid', 'Pending'] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$totalPrice' },
                        orderCount: { $sum: 1 },
                        averageOrderValue: { $avg: '$totalPrice' }
                    }
                }
            ]),
            // Previous period revenue
            OrderV2Model.aggregate([
                {
                    $match: {
                        createdAt: { $gte: previousStartDate, $lte: previousEndDate },
                        orderStatus: { $ne: 'Cancelled' },
                        paymentStatus: { $in: ['Paid', 'Pending'] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$totalPrice' },
                        orderCount: { $sum: 1 },
                        averageOrderValue: { $avg: '$totalPrice' }
                    }
                }
            ])
        ]);

        // Use only the V2 revenue (since there's only one order model)
        const currentRev = currentRevenue[0] || { totalRevenue: 0, orderCount: 0, averageOrderValue: 0 };
        const previousRev = previousRevenue[0] || { totalRevenue: 0, orderCount: 0, averageOrderValue: 0 };

        const totalCurrentRevenue = currentRev.totalRevenue;
        const totalPreviousRevenue = previousRev.totalRevenue;
        const totalCurrentOrders = currentRev.orderCount;
        const totalPreviousOrders = previousRev.orderCount;

        // User Analytics
        const [currentUsers, previousUsers, totalUsers] = await Promise.all([
            UserModel.countDocuments({
                createdAt: { $gte: startDate, $lte: endDate }
            }),
            UserModel.countDocuments({
                createdAt: { $gte: previousStartDate, $lte: previousEndDate }
            }),
            UserModel.countDocuments()
        ]);

        // Get low stock threshold from site settings
        const settings = await SiteSettingsModel.getSettings();
        const lowStockThreshold = settings.productSettings?.lowStockThreshold || 3;

        // Product Analytics
        const [totalProducts, lowStockProducts, outOfStockProducts] = await Promise.all([
            ProductModel.countDocuments(),
            ProductModel.countDocuments({ stock: { $lt: lowStockThreshold, $gt: 0 } }),
            ProductModel.countDocuments({ stock: 0 })
        ]);

        // Order Status Analytics
        const orderStatusAnalytics = await OrderV2Model.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: '$orderStatus',
                    count: { $sum: 1 },
                    revenue: { $sum: '$totalPrice' }
                }
            }
        ]);

        // Payment Method Analytics
        const paymentMethodAnalytics = await OrderV2Model.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    orderStatus: { $ne: 'Cancelled' }
                }
            },
            {
                $group: {
                    _id: '$paymentMethod',
                    count: { $sum: 1 },
                    revenue: { $sum: '$totalPrice' }
                }
            }
        ]);

        // Daily Revenue Trend (last 30 days)
        const dailyRevenueTrend = await OrderV2Model.aggregate([
            {
                $match: {
                    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                    orderStatus: { $ne: 'Cancelled' },
                    paymentStatus: { $in: ['Paid', 'Pending'] }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    revenue: { $sum: '$totalPrice' },
                    orders: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Top Products by Revenue
        const topProducts = await OrderV2Model.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    orderStatus: { $ne: 'Cancelled' }
                }
            },
            {
                $unwind: '$orderItems'
            },
            {
                $group: {
                    _id: '$orderItems.name',
                    revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } },
                    quantity: { $sum: '$orderItems.quantity' },
                    orders: { $addToSet: '$_id' }
                }
            },
            {
                $project: {
                    name: '$_id',
                    revenue: 1,
                    quantity: 1,
                    orderCount: { $size: '$orders' }
                }
            },
            {
                $sort: { revenue: -1 }
            },
            {
                $limit: 10
            }
        ]);

        // Coupon Analytics
        const couponAnalytics = await OrderV2Model.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    'coupon.code': { $ne: '' }
                }
            },
            {
                $group: {
                    _id: '$coupon.code',
                    usageCount: { $sum: 1 },
                    totalDiscount: { $sum: '$coupon.discountAmount' },
                    totalRevenue: { $sum: '$totalPrice' }
                }
            },
            {
                $sort: { usageCount: -1 }
            },
            {
                $limit: 10
            }
        ]);

        // Customer Analytics
        const customerAnalytics = await OrderV2Model.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    orderStatus: { $ne: 'Cancelled' }
                }
            },
            {
                $group: {
                    _id: '$user',
                    totalSpent: { $sum: '$totalPrice' },
                    orderCount: { $sum: 1 },
                    averageOrderValue: { $avg: '$totalPrice' }
                }
            },
            {
                $sort: { totalSpent: -1 }
            },
            {
                $limit: 10
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            {
                $project: {
                    customerName: { $arrayElemAt: ['$userDetails.name', 0] },
                    customerEmail: { $arrayElemAt: ['$userDetails.email', 0] },
                    totalSpent: 1,
                    orderCount: 1,
                    averageOrderValue: 1
                }
            }
        ]);

        // Get visitor analytics
        const [currentTotalVisitors, currentUniqueVisitors, currentLiveVisitors] = await Promise.all([
            VisitorModel.getVisitorsByDateRange(startDate, endDate),
            VisitorModel.getUniqueVisitorsByDateRange(startDate, endDate).then(ips => ips.length),
            VisitorModel.getLiveVisitors()
        ]);


        const [previousTotalVisitors, previousUniqueVisitors] = await Promise.all([
            VisitorModel.getVisitorsByDateRange(previousStartDate, previousEndDate),
            VisitorModel.getUniqueVisitorsByDateRange(previousStartDate, previousEndDate).then(ips => ips.length)
        ]);

        // Calculate visitor growth
        const totalVisitorsGrowth = previousTotalVisitors > 0 
            ? ((currentTotalVisitors - previousTotalVisitors) / previousTotalVisitors) * 100 
            : currentTotalVisitors > 0 ? 100 : 0;

        const uniqueVisitorsGrowth = previousUniqueVisitors > 0 
            ? ((currentUniqueVisitors - previousUniqueVisitors) / previousUniqueVisitors) * 100 
            : currentUniqueVisitors > 0 ? 100 : 0;

        // Get all-time visitor totals
        const allTimeTotalVisitors = await VisitorModel.getTotalVisitors();

        // Get visitor daily trend and top pages
        const [visitorDailyTrend, visitorTopPages] = await Promise.all([
            VisitorModel.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate }
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
            ]),
            VisitorModel.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lte: endDate }
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
            ])
        ]);

        // Return Customer Analytics
        const returnCustomerAnalytics = await OrderV2Model.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    orderStatus: { $ne: 'Cancelled' }
                }
            },
                            {
                    $group: {
                        _id: '$user',
                        orderCount: { $sum: 1 },
                        totalSpent: { $sum: '$totalPrice' },
                        firstOrderDate: { $min: '$createdAt' },
                        lastOrderDate: { $max: '$createdAt' }
                    }
                },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            {
                $unwind: {
                    path: '$userDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    userId: '$_id',
                    customerName: '$userDetails.name',
                    customerEmail: '$userDetails.email',
                    orderCount: 1,
                    totalSpent: 1,
                    firstOrderDate: 1,
                    lastOrderDate: 1,
                    isReturnCustomer: { $gt: ['$orderCount', 1] }
                }
            }
        ]);

        // Calculate return customer metrics
        const totalCustomers = returnCustomerAnalytics.length;
        const returnCustomers = returnCustomerAnalytics.filter(customer => customer.isReturnCustomer);
        const newCustomers = returnCustomerAnalytics.filter(customer => !customer.isReturnCustomer);
        
        const returnCustomerCount = returnCustomers.length;
        const newCustomerCount = newCustomers.length;
        const returnCustomerRate = totalCustomers > 0 ? (returnCustomerCount / totalCustomers) * 100 : 0;
        
        // Calculate return customer revenue
        const returnCustomerRevenue = returnCustomers.reduce((sum, customer) => sum + customer.totalSpent, 0);
        const newCustomerRevenue = newCustomers.reduce((sum, customer) => sum + customer.totalSpent, 0);
        const totalCustomerRevenue = returnCustomerRevenue + newCustomerRevenue;
        
        // Calculate average order value for return vs new customers
        const avgReturnCustomerOrderValue = returnCustomerCount > 0 ? returnCustomerRevenue / returnCustomerCount : 0;
        const avgNewCustomerOrderValue = newCustomerCount > 0 ? newCustomerRevenue / newCustomerCount : 0;
        
        // Get previous period data for comparison
        const previousReturnCustomerAnalytics = await OrderV2Model.aggregate([
            {
                $match: {
                    createdAt: { $gte: previousStartDate, $lte: previousEndDate },
                    orderStatus: { $ne: 'Cancelled' }
                }
            },
            {
                $group: {
                    _id: '$user',
                    orderCount: { $sum: 1 }
                }
            },
            {
                $project: {
                    isReturnCustomer: { $gt: ['$orderCount', 1] }
                }
            }
        ]);
        
        const previousTotalCustomers = previousReturnCustomerAnalytics.length;
        const previousReturnCustomers = previousReturnCustomerAnalytics.filter(customer => customer.isReturnCustomer).length;
        const previousReturnCustomerRate = previousTotalCustomers > 0 ? (previousReturnCustomers / previousTotalCustomers) * 100 : 0;
        
        // Top return customers (by total spent)
        const topReturnCustomers = returnCustomers
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, 10)
            .map(customer => ({
                name: customer.customerName || 'Unknown',
                email: customer.customerEmail || 'No email',
                orderCount: customer.orderCount,
                totalSpent: customer.totalSpent,
                averageOrderValue: customer.totalSpent / customer.orderCount,
                firstOrderDate: customer.firstOrderDate,
                lastOrderDate: customer.lastOrderDate,
                formattedTotalSpent: formatCurrency(customer.totalSpent),
                formattedAverageOrder: formatCurrency(customer.totalSpent / customer.orderCount)
            }));

        // Customer lifetime value analysis
        const customerLifetimeValue = await OrderV2Model.aggregate([
            {
                $match: {
                    orderStatus: { $ne: 'Cancelled' }
                }
            },
            {
                $group: {
                    _id: '$user',
                    totalSpent: { $sum: '$totalPrice' },
                    orderCount: { $sum: 1 },
                    firstOrderDate: { $min: '$createdAt' },
                    lastOrderDate: { $max: '$createdAt' }
                }
            },
            {
                $project: {
                    totalSpent: 1,
                    orderCount: 1,
                    lifetimeDays: {
                        $divide: [
                            { $subtract: ['$lastOrderDate', '$firstOrderDate'] },
                            1000 * 60 * 60 * 24
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    avgLifetimeValue: { $avg: '$totalSpent' },
                    avgLifetimeDays: { $avg: '$lifetimeDays' },
                    avgOrdersPerCustomer: { $avg: '$orderCount' }
                }
            }
        ]);

        const lifetimeValueData = customerLifetimeValue[0] || {
            avgLifetimeValue: 0,
            avgLifetimeDays: 0,
            avgOrdersPerCustomer: 0
        };

        // Response data
        const analytics = {
            period,
            dateRange: {
                start: startDate,
                end: endDate
            },
            revenue: {
                current: {
                    total: totalCurrentRevenue,
                    formatted: formatCurrency(totalCurrentRevenue),
                    orders: totalCurrentOrders,
                    averageOrderValue: totalCurrentOrders > 0 ? totalCurrentRevenue / totalCurrentOrders : 0
                },
                previous: {
                    total: totalPreviousRevenue,
                    formatted: formatCurrency(totalPreviousRevenue),
                    orders: totalPreviousOrders,
                    averageOrderValue: totalPreviousOrders > 0 ? totalPreviousRevenue / totalPreviousOrders : 0
                },
                growth: {
                    percentage: calculatePercentageChange(totalCurrentRevenue, totalPreviousRevenue),
                    trend: totalCurrentRevenue > totalPreviousRevenue ? 'up' : 'down'
                }
            },
            users: {
                current: currentUsers,
                previous: previousUsers,
                total: totalUsers,
                growth: {
                    percentage: calculatePercentageChange(currentUsers, previousUsers),
                    trend: currentUsers > previousUsers ? 'up' : 'down'
                }
            },
            products: {
                total: totalProducts,
                lowStock: lowStockProducts,
                outOfStock: outOfStockProducts,
                lowStockPercentage: totalProducts > 0 ? (lowStockProducts / totalProducts) * 100 : 0
            },
            visitors: {
                current: {
                    totalVisitors: currentTotalVisitors,
                    uniqueVisitors: currentUniqueVisitors,
                    liveVisitors: currentLiveVisitors
                },
                previous: {
                    totalVisitors: previousTotalVisitors,
                    uniqueVisitors: previousUniqueVisitors
                },
                allTime: {
                    totalVisitors: allTimeTotalVisitors
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
                dailyTrend: visitorDailyTrend,
                topPages: visitorTopPages
            },
            orderStatus: orderStatusAnalytics.map(status => ({
                status: status._id,
                count: status.count,
                revenue: status.revenue,
                formattedRevenue: formatCurrency(status.revenue)
            })),
            paymentMethods: paymentMethodAnalytics.map(method => ({
                method: method._id,
                count: method.count,
                revenue: method.revenue,
                formattedRevenue: formatCurrency(method.revenue),
                percentage: totalCurrentOrders > 0 ? (method.count / totalCurrentOrders) * 100 : 0
            })),
            dailyTrend: dailyRevenueTrend.map(day => ({
                date: day._id,
                revenue: day.revenue,
                orders: day.orders,
                formattedRevenue: formatCurrency(day.revenue)
            })),
            topProducts: topProducts.map(product => ({
                name: product.name,
                revenue: product.revenue,
                quantity: product.quantity,
                orderCount: product.orderCount,
                formattedRevenue: formatCurrency(product.revenue)
            })),
            topCoupons: couponAnalytics.map(coupon => ({
                code: coupon._id,
                usageCount: coupon.usageCount,
                totalDiscount: coupon.totalDiscount,
                totalRevenue: coupon.totalRevenue,
                formattedDiscount: formatCurrency(coupon.totalDiscount),
                formattedRevenue: formatCurrency(coupon.totalRevenue)
            })),
            topCustomers: customerAnalytics.map(customer => ({
                name: customer.customerName,
                email: customer.customerEmail,
                totalSpent: customer.totalSpent,
                orderCount: customer.orderCount,
                averageOrderValue: customer.averageOrderValue,
                formattedTotalSpent: formatCurrency(customer.totalSpent),
                formattedAverageOrder: formatCurrency(customer.averageOrderValue)
            })),
            returnCustomers: {
                current: {
                    total: totalCustomers,
                    returnCustomers: returnCustomerCount,
                    newCustomers: newCustomerCount,
                    returnCustomerRate: Math.round(returnCustomerRate * 10) / 10,
                    returnCustomerRevenue: returnCustomerRevenue,
                    newCustomerRevenue: newCustomerRevenue,
                    totalCustomerRevenue: totalCustomerRevenue,
                    avgReturnCustomerOrderValue: avgReturnCustomerOrderValue,
                    avgNewCustomerOrderValue: avgNewCustomerOrderValue,
                    formattedReturnCustomerRevenue: formatCurrency(returnCustomerRevenue),
                    formattedNewCustomerRevenue: formatCurrency(newCustomerRevenue),
                    formattedTotalCustomerRevenue: formatCurrency(totalCustomerRevenue),
                    formattedAvgReturnCustomerOrderValue: formatCurrency(avgReturnCustomerOrderValue),
                    formattedAvgNewCustomerOrderValue: formatCurrency(avgNewCustomerOrderValue)
                },
                previous: {
                    total: previousTotalCustomers,
                    returnCustomers: previousReturnCustomers,
                    returnCustomerRate: Math.round(previousReturnCustomerRate * 10) / 10
                },
                growth: {
                    returnCustomerRate: {
                        percentage: Math.round((returnCustomerRate - previousReturnCustomerRate) * 10) / 10,
                        trend: returnCustomerRate > previousReturnCustomerRate ? 'up' : 'down'
                    },
                    returnCustomerCount: {
                        percentage: calculatePercentageChange(returnCustomerCount, previousReturnCustomers),
                        trend: returnCustomerCount > previousReturnCustomers ? 'up' : 'down'
                    }
                },
                lifetimeValue: {
                    avgLifetimeValue: lifetimeValueData.avgLifetimeValue,
                    avgLifetimeDays: Math.round(lifetimeValueData.avgLifetimeDays),
                    avgOrdersPerCustomer: Math.round(lifetimeValueData.avgOrdersPerCustomer * 10) / 10,
                    formattedAvgLifetimeValue: formatCurrency(lifetimeValueData.avgLifetimeValue)
                },
                topReturnCustomers: topReturnCustomers
            }
        };

        res.json({
            success: true,
            message: 'Analytics data retrieved successfully',
            data: analytics
        });

    } catch (error) {
        // Log error for debugging (remove in production)
        // console.error('Analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve analytics data',
            error: error.message
        });
    }
};

/**
 * Get revenue analytics with detailed breakdown
 */
export const getRevenueAnalytics = async (req, res) => {
    try {
        const { period = 'month', groupBy = 'day' } = req.query;
        const { startDate, endDate } = getDateRange(period);

        // Revenue by date grouping
        const revenueByDate = await OrderV2Model.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    orderStatus: { $ne: 'Cancelled' },
                    paymentStatus: { $in: ['Paid', 'Pending'] }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { 
                            format: groupBy === 'month' ? "%Y-%m" : "%Y-%m-%d", 
                            date: "$createdAt" 
                        }
                    },
                    revenue: { $sum: '$totalPrice' },
                    orders: { $sum: 1 },
                    averageOrderValue: { $avg: '$totalPrice' }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Revenue by category (if products have categories)
        const revenueByCategory = await OrderV2Model.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    orderStatus: { $ne: 'Cancelled' }
                }
            },
            {
                $unwind: '$orderItems'
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderItems.product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            {
                $group: {
                    _id: { $arrayElemAt: ['$productDetails.category', 0] },
                    revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } },
                    orders: { $addToSet: '$_id' }
                }
            },
            {
                $project: {
                    category: '$_id',
                    revenue: 1,
                    orderCount: { $size: '$orders' }
                }
            },
            {
                $sort: { revenue: -1 }
            }
        ]);

        // Revenue by payment method
        const revenueByPaymentMethod = await OrderV2Model.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    orderStatus: { $ne: 'Cancelled' }
                }
            },
            {
                $group: {
                    _id: '$paymentMethod',
                    revenue: { $sum: '$totalPrice' },
                    orders: { $sum: 1 },
                    averageOrderValue: { $avg: '$totalPrice' }
                }
            },
            {
                $sort: { revenue: -1 }
            }
        ]);

        res.json({
            success: true,
            message: 'Revenue analytics retrieved successfully',
            data: {
                period,
                dateRange: { start: startDate, end: endDate },
                byDate: revenueByDate.map(item => ({
                    date: item._id,
                    revenue: item.revenue,
                    orders: item.orders,
                    averageOrderValue: item.averageOrderValue,
                    formattedRevenue: formatCurrency(item.revenue)
                })),
                byCategory: revenueByCategory.map(item => ({
                    category: item.category,
                    revenue: item.revenue,
                    orderCount: item.orderCount,
                    formattedRevenue: formatCurrency(item.revenue)
                })),
                byPaymentMethod: revenueByPaymentMethod.map(item => ({
                    method: item._id,
                    revenue: item.revenue,
                    orders: item.orders,
                    averageOrderValue: item.averageOrderValue,
                    formattedRevenue: formatCurrency(item.revenue)
                }))
            }
        });

    } catch (error) {
        // Log error for debugging (remove in production)
        // console.error('Revenue analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve revenue analytics',
            error: error.message
        });
    }
};

/**
 * Get customer analytics
 */
export const getCustomerAnalytics = async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        const { startDate, endDate } = getDateRange(period);

        // Customer acquisition
        const customerAcquisition = await UserModel.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    newCustomers: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Customer lifetime value
        const customerLTV = await OrderV2Model.aggregate([
            {
                $match: {
                    orderStatus: { $ne: 'Cancelled' }
                }
            },
            {
                $group: {
                    _id: '$user',
                    totalSpent: { $sum: '$totalPrice' },
                    orderCount: { $sum: 1 },
                    firstOrder: { $min: '$createdAt' },
                    lastOrder: { $max: '$createdAt' }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            {
                $project: {
                    customerName: { $arrayElemAt: ['$userDetails.name', 0] },
                    customerEmail: { $arrayElemAt: ['$userDetails.email', 0] },
                    totalSpent: 1,
                    orderCount: 1,
                    firstOrder: 1,
                    lastOrder: 1,
                    averageOrderValue: { $divide: ['$totalSpent', '$orderCount'] }
                }
            },
            {
                $sort: { totalSpent: -1 }
            },
            {
                $limit: 20
            }
        ]);

        // Customer segments
        const customerSegments = await OrderV2Model.aggregate([
            {
                $match: {
                    orderStatus: { $ne: 'Cancelled' }
                }
            },
            {
                $group: {
                    _id: '$user',
                    totalSpent: { $sum: '$totalPrice' },
                    orderCount: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: {
                        segment: {
                            $cond: {
                                if: { $gte: ['$totalSpent', 10000] },
                                then: 'High Value',
                                else: {
                                    $cond: {
                                        if: { $gte: ['$totalSpent', 5000] },
                                        then: 'Medium Value',
                                        else: 'Low Value'
                                    }
                                }
                            }
                        }
                    },
                    count: { $sum: 1 },
                    totalRevenue: { $sum: '$totalSpent' }
                }
            },
            {
                $sort: { '_id.segment': 1 }
            }
        ]);

        res.json({
            success: true,
            message: 'Customer analytics retrieved successfully',
            data: {
                period,
                dateRange: { start: startDate, end: endDate },
                acquisition: customerAcquisition.map(item => ({
                    date: item._id,
                    newCustomers: item.newCustomers
                })),
                topCustomers: customerLTV.map(customer => ({
                    name: customer.customerName,
                    email: customer.customerEmail,
                    totalSpent: customer.totalSpent,
                    orderCount: customer.orderCount,
                    averageOrderValue: customer.averageOrderValue,
                    firstOrder: customer.firstOrder,
                    lastOrder: customer.lastOrder,
                    formattedTotalSpent: formatCurrency(customer.totalSpent),
                    formattedAverageOrder: formatCurrency(customer.averageOrderValue)
                })),
                segments: customerSegments.map(segment => ({
                    segment: segment._id.segment,
                    count: segment.count,
                    totalRevenue: segment.totalRevenue,
                    formattedRevenue: formatCurrency(segment.totalRevenue),
                    percentage: customerLTV.length > 0 ? (segment.count / customerLTV.length) * 100 : 0
                }))
            }
        });

    } catch (error) {
        // Log error for debugging (remove in production)
        // console.error('Customer analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve customer analytics',
            error: error.message
        });
    }
};

/**
 * Get product analytics
 */
export const getProductAnalytics = async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        const { startDate, endDate } = getDateRange(period);

        // Top selling products
        const topSellingProducts = await OrderV2Model.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    orderStatus: { $ne: 'Cancelled' }
                }
            },
            {
                $unwind: '$orderItems'
            },
            {
                $group: {
                    _id: '$orderItems.name',
                    totalQuantity: { $sum: '$orderItems.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } },
                    orderCount: { $addToSet: '$_id' }
                }
            },
            {
                $project: {
                    name: '$_id',
                    totalQuantity: 1,
                    totalRevenue: 1,
                    orderCount: { $size: '$orderCount' },
                    averagePrice: { $divide: ['$totalRevenue', '$totalQuantity'] }
                }
            },
            {
                $sort: { totalQuantity: -1 }
            },
            {
                $limit: 20
            }
        ]);

        // Product performance by revenue
        const productRevenuePerformance = await OrderV2Model.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    orderStatus: { $ne: 'Cancelled' }
                }
            },
            {
                $unwind: '$orderItems'
            },
            {
                $group: {
                    _id: '$orderItems.name',
                    revenue: { $sum: { $multiply: ['$orderItems.price', '$orderItems.quantity'] } },
                    quantity: { $sum: '$orderItems.quantity' }
                }
            },
            {
                $sort: { revenue: -1 }
            },
            {
                $limit: 15
            }
        ]);

        // Get low stock threshold from site settings
        const settings = await SiteSettingsModel.getSettings();
        const lowStockThreshold = settings.productSettings?.lowStockThreshold || 3;

        // Stock analytics
        const stockAnalytics = await ProductModel.aggregate([
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    inStock: { $sum: { $cond: [{ $gt: ['$stock', 0] }, 1, 0] } },
                    outOfStock: { $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] } },
                    lowStock: { $sum: { $cond: [{ $and: [{ $gt: ['$stock', 0] }, { $lt: ['$stock', lowStockThreshold] }] }, 1, 0] } },
                    averageStock: { $avg: '$stock' },
                    totalStockValue: { $sum: { $multiply: ['$price', '$stock'] } }
                }
            }
        ]);

        res.json({
            success: true,
            message: 'Product analytics retrieved successfully',
            data: {
                period,
                dateRange: { start: startDate, end: endDate },
                topSelling: topSellingProducts.map(product => ({
                    name: product.name,
                    totalQuantity: product.totalQuantity,
                    totalRevenue: product.totalRevenue,
                    orderCount: product.orderCount,
                    averagePrice: product.averagePrice,
                    formattedRevenue: formatCurrency(product.totalRevenue),
                    formattedAveragePrice: formatCurrency(product.averagePrice)
                })),
                revenuePerformance: productRevenuePerformance.map(product => ({
                    name: product._id,
                    revenue: product.revenue,
                    quantity: product.quantity,
                    formattedRevenue: formatCurrency(product.revenue)
                })),
                stock: stockAnalytics[0] ? {
                    totalProducts: stockAnalytics[0].totalProducts,
                    inStock: stockAnalytics[0].inStock,
                    outOfStock: stockAnalytics[0].outOfStock,
                    lowStock: stockAnalytics[0].lowStock,
                    averageStock: Math.round(stockAnalytics[0].averageStock),
                    totalStockValue: stockAnalytics[0].totalStockValue,
                    formattedStockValue: formatCurrency(stockAnalytics[0].totalStockValue),
                    inStockPercentage: stockAnalytics[0].totalProducts > 0 ? 
                        (stockAnalytics[0].inStock / stockAnalytics[0].totalProducts) * 100 : 0
                } : null
            }
        });

    } catch (error) {
        // Log error for debugging (remove in production)
        // console.error('Product analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve product analytics',
            error: error.message
        });
    }
};

/**
 * Get abandoned cart analytics
 */
export const getAbandonedCartAnalytics = async (req, res) => {
    try {
        const { period = 'week', limit = 50 } = req.query;
        const { startDate, endDate } = getDateRange(period);

        // Get abandoned carts (carts with items but no orders in the last 6 hours)
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        
        // Find carts that were updated more than 6 hours ago but haven't been converted to orders
        const abandonedCarts = await CartProductModel.aggregate([
            {
                $match: {
                    updatedAt: { $lt: sixHoursAgo }
                }
            },
            {
                $group: {
                    _id: '$userId',
                    cartItems: { $push: '$$ROOT' },
                    totalItems: { $sum: 1 },
                    lastUpdated: { $max: '$updatedAt' }
                }
            },
            {
                $addFields: {
                    cartAge: { 
                        $divide: [
                            { $subtract: [new Date(), '$lastUpdated'] },
                            1000 * 60 * 60 * 24 // Convert to days
                        ]
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'cartItems.productId',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            {
                $project: {
                    userId: '$_id',
                    userDetails: { $arrayElemAt: ['$userDetails', 0] },
                    cartItems: 1,
                    totalItems: 1,
                    lastUpdated: 1,
                    cartAge: 1,
                    products: '$productDetails'
                }
            },
            {
                $sort: { lastUpdated: -1 }
            },
            {
                $limit: parseInt(limit)
            }
        ]);

        // Calculate abandoned cart metrics
        const abandonedCartMetrics = await CartProductModel.aggregate([
            {
                $match: {
                    updatedAt: { $lt: sixHoursAgo }
                }
            },
            {
                $group: {
                    _id: null,
                    totalAbandonedCarts: { $addToSet: '$userId' },
                    totalAbandonedItems: { $sum: 1 }
                }
            },
            {
                $project: {
                    totalAbandonedCarts: { $size: '$totalAbandonedCarts' },
                    totalAbandonedItems: 1
                }
            }
        ]);

        // Get cart abandonment rate (carts created vs orders placed)
        const cartAbandonmentRate = await Promise.all([
            // Total unique users with carts in the period
            CartProductModel.distinct('userId', {
                createdAt: { $gte: startDate, $lte: endDate }
            }),
            // Users who placed orders in the period
            OrderV2Model.distinct('user', {
                createdAt: { $gte: startDate, $lte: endDate },
                orderStatus: { $ne: 'Cancelled' }
            })
        ]);

        const totalCartUsers = cartAbandonmentRate[0].length;
        const totalOrderUsers = cartAbandonmentRate[1].length;
        const abandonmentRate = totalCartUsers > 0 ? 
            ((totalCartUsers - totalOrderUsers) / totalCartUsers) * 100 : 0;

        // Format the response
        const formattedAbandonedCarts = abandonedCarts.map(cart => {
            const user = cart.userDetails || {};
            const products = cart.products || [];
            
            return {
                userId: cart.userId,
                userEmail: user.email || 'Unknown',
                userName: user.name || 'Unknown User',
                totalItems: cart.totalItems,
                lastUpdated: cart.lastUpdated,
                cartAge: Math.round(cart.cartAge || 0),
                products: products.map(product => ({
                    name: product.name || 'Unknown Product',
                    price: product.price || 0,
                    quantity: cart.cartItems.find(item => 
                        item.productId.toString() === product._id.toString()
                    )?.quantity || 1
                }))
            };
        });

        const metrics = abandonedCartMetrics[0] || {
            totalAbandonedCarts: 0,
            totalAbandonedItems: 0
        };

        res.json({
            success: true,
            message: 'Abandoned cart analytics retrieved successfully',
            data: {
                period,
                dateRange: { start: startDate, end: endDate },
                metrics: {
                    totalAbandonedCarts: metrics.totalAbandonedCarts,
                    totalAbandonedItems: metrics.totalAbandonedItems,
                    abandonmentRate: Math.round(abandonmentRate * 100) / 100
                },
                abandonedCarts: formattedAbandonedCarts
            }
        });

    } catch (error) {
        // Log error for debugging (remove in production)
        // console.error('Abandoned cart analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve abandoned cart analytics',
            error: error.message
        });
    }
};
