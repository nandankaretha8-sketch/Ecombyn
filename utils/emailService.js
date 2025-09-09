import sendEmail from '../config/sendEmail.js';
import verifyEmailTemplate from './verifyEmailTemplate.js';
import forgotPasswordTemplate from './forgotPasswordTemplate.js';
import orderStatusEmailTemplate from './orderStatusEmailTemplate.js';
import trackingUpdateEmailTemplate from './trackingUpdateEmailTemplate.js';
import UserModel from '../models/user.model.js';

class EmailService {
    /**
     * Send email verification
     * @param {string} email - User's email
     * @param {string} name - User's name
     * @param {string} userId - User's ID for verification
     * @returns {Promise<Object>} Email sending result
     */
    static async sendVerificationEmail(email, name, userId) {
        try {
            const verificationUrl = `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/verify-email?code=${userId}`;
            
            const result = await sendEmail({
                sendTo: email,
                subject: "Verify Your Email - Akshar Art",
                html: verifyEmailTemplate({
                    name: name,
                    url: verificationUrl
                })
            });

            return result;
            } catch (error) {
        // Log error for debugging (remove in production)
        // console.error('Verification email error:', error);
        return { success: false, error: error.message };
    }
    }

    /**
     * Send password reset email
     * @param {string} email - User's email
     * @param {string} name - User's name
     * @param {string} otp - One-time password
     * @returns {Promise<Object>} Email sending result
     */
    static async sendPasswordResetEmail(email, name, otp) {
        try {
            const result = await sendEmail({
                sendTo: email,
                subject: "Reset Your Password - Akshar Art",
                html: forgotPasswordTemplate({
                    name: name,
                    otp: otp
                })
            });

            return result;
        } catch (error) {
            // Log error for debugging (remove in production)
            // console.error('Password reset email error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send order status update email
     * @param {string} orderId - Order ID
     * @param {string} status - New order status
     * @param {Object} orderData - Order details
     * @returns {Promise<Object>} Email sending result
     */
    static async sendOrderStatusEmail(orderId, status, orderData) {
        try {
            // Get user details
            const user = await UserModel.findById(orderData.user || orderData.userId);
            if (!user) {
                // Log error for debugging (remove in production)
                // console.error('User not found for order status email:', orderData.user || orderData.userId);
                return { success: false, error: 'User not found' };
            }

            // Prepare order details for email
            const orderDetails = this.prepareOrderDetails(orderData);
            
            // Get tracking info if available
            const trackingInfo = orderData.tracking || null;
            
            // Use actual delivery date if set, otherwise calculate estimated delivery
            let estimatedDelivery = null;
            if (orderData.deliveryDate) {
                // Use the actual delivery date set by admin
                const deliveryDate = new Date(orderData.deliveryDate);
                estimatedDelivery = deliveryDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } else {
                // Calculate estimated delivery based on status
                estimatedDelivery = this.calculateEstimatedDelivery(status, orderData.createdAt);
            }

            // Get contact information from site settings or environment
            let contactInfo = {};
            try {
                const SiteSettingsModel = (await import('../models/siteSettings.model.js')).default;
                const siteSettings = await SiteSettingsModel.getSettings();
                if (siteSettings.contactInfo) {
                    contactInfo = {
                        email: siteSettings.contactInfo.email || process.env.SUPPORT_EMAIL,
                        phone: siteSettings.contactInfo.phone || process.env.SUPPORT_PHONE
                    };
                }
            } catch (settingsError) {
                // Fallback to environment variables if site settings fail
                contactInfo = {
                    email: process.env.SUPPORT_EMAIL,
                    phone: process.env.SUPPORT_PHONE
                };
            }

            const result = await sendEmail({
                sendTo: user.email,
                subject: `Order ${status} - #${orderData.orderNumber || orderData.orderId}`,
                html: orderStatusEmailTemplate({
                    name: user.name,
                    orderNumber: orderData.orderNumber || orderData.orderId,
                    status: status,
                    orderDetails: orderDetails,
                    trackingInfo: trackingInfo,
                    estimatedDelivery: estimatedDelivery,
                    contactInfo: contactInfo
                })
            });

            return result;
        } catch (error) {
            // Log error for debugging (remove in production)
            // console.error('Order status email error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send order confirmation email (when order is first created)
     * @param {Object} orderData - Order details
     * @returns {Promise<Object>} Email sending result
     */
    static async sendOrderConfirmationEmail(orderData) {
        try {
            const user = await UserModel.findById(orderData.user || orderData.userId);
            if (!user) {
                return { success: false, error: 'User not found' };
            }

            const orderDetails = this.prepareOrderDetails(orderData);

            // Get contact information from site settings or environment
            let contactInfo = {};
            try {
                const SiteSettingsModel = (await import('../models/siteSettings.model.js')).default;
                const siteSettings = await SiteSettingsModel.getSettings();
                if (siteSettings.contactInfo) {
                    contactInfo = {
                        email: siteSettings.contactInfo.email || process.env.SUPPORT_EMAIL,
                        phone: siteSettings.contactInfo.phone || process.env.SUPPORT_PHONE
                    };
                }
            } catch (settingsError) {
                // Fallback to environment variables if site settings fail
                contactInfo = {
                    email: process.env.SUPPORT_EMAIL,
                    phone: process.env.SUPPORT_PHONE
                };
            }

            const result = await sendEmail({
                sendTo: user.email,
                subject: `Order Confirmed - #${orderData.orderNumber || orderData.orderId}`,
                html: orderStatusEmailTemplate({
                    name: user.name,
                    orderNumber: orderData.orderNumber || orderData.orderId,
                    status: 'Pending',
                    orderDetails: orderDetails,
                    trackingInfo: null,
                    estimatedDelivery: orderData.deliveryDate ? 
                        new Date(orderData.deliveryDate).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        }) : 
                        this.calculateEstimatedDelivery('Pending', orderData.createdAt),
                    contactInfo: contactInfo
                })
            });

            return result;
        } catch (error) {
            // Log error for debugging (remove in production)
            // console.error('Order confirmation email error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Prepare order details for email template
     * @param {Object} orderData - Order data
     * @returns {Array} Formatted order items
     */
    static prepareOrderDetails(orderData) {
        if (orderData.orderItems && Array.isArray(orderData.orderItems)) {
            // V2 order format
            return orderData.orderItems.map(item => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price
            }));
        } else {
            // Legacy order format
            return [{
                name: orderData.product_details?.name || 'Product',
                quantity: 1,
                price: orderData.subTotalAmt || orderData.totalAmt || 0
            }];
        }
    }

    /**
     * Calculate estimated delivery date based on status
     * @param {string} status - Order status
     * @param {Date} orderDate - Order creation date
     * @returns {string} Estimated delivery date
     */
    static calculateEstimatedDelivery(status, orderDate) {
        const orderCreated = new Date(orderDate);
        let estimatedDays = 0;

        switch (status) {
            case 'Pending':
                estimatedDays = 7; // 5-7 business days
                break;
            case 'Confirmed':
                estimatedDays = 5; // 3-5 business days
                break;
            case 'Shipped':
                estimatedDays = 3; // 2-3 business days
                break;
            case 'Out for Delivery':
                estimatedDays = 1; // Same day or next day
                break;
            case 'Delivered':
                return 'Delivered';
            case 'Cancelled':
                return 'Order Cancelled';
            default:
                estimatedDays = 7;
        }

        const estimatedDate = new Date(orderCreated);
        estimatedDate.setDate(estimatedDate.getDate() + estimatedDays);
        
        return estimatedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * Send welcome email to new users
     * @param {string} email - User's email
     * @param {string} name - User's name
     * @returns {Promise<Object>} Email sending result
     */
    static async sendWelcomeEmail(email, name) {
        try {
            const result = await sendEmail({
                sendTo: email,
                subject: "Welcome to Akshar Art! 🎨",
                html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Akshar Art</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
        }
        .content {
            padding: 40px 30px;
        }
        .welcome-text {
            font-size: 20px;
            margin-bottom: 20px;
            color: #555;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 15px 30px;
            border-radius: 25px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 32px;">🎨 Welcome to Akshar Art!</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px; opacity: 0.9;">Your journey into the world of art begins here</p>
        </div>
        
        <div class="content">
            <p class="welcome-text">Hello ${name},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px; color: #666;">
                Welcome to Akshar Art! We're thrilled to have you join our community of art lovers and creators. 
                Your account has been successfully verified and you're now ready to explore our beautiful collection 
                of handcrafted art pieces, paintings, and unique artistic creations.
            </p>
            
            <div style="text-align: center;">
                <a href="${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}" 
                   class="cta-button"
                   style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; text-align: center; border: none; font-size: 16px; line-height: 1.5;">
                    Start Shopping
                </a>
            </div>
            
            <p style="font-size: 16px; margin-top: 30px; color: #666;">
                Here's what you can do with your new account:
            </p>
            
            <ul style="font-size: 16px; color: #666; line-height: 1.8;">
                <li>Browse our extensive collection of art pieces</li>
                <li>Save your favorite items to your wishlist</li>
                <li>Track your orders in real-time</li>
                <li>Get exclusive offers and updates</li>
                <li>Connect with our community of art enthusiasts</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>© 2024 Akshar Art. All rights reserved.</p>
            <p>Thank you for choosing Akshar Art for your artistic journey!</p>
        </div>
    </div>
</body>
</html>
                `
            });

            return result;
        } catch (error) {
            // Log error for debugging (remove in production)
            // console.error('Welcome email error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send tracking update email
     * @param {string} orderId - Order ID
     * @param {Object} trackingInfo - Tracking information
     * @param {Object} orderData - Order details
     * @returns {Promise<Object>} Email sending result
     */
    static async sendTrackingUpdateEmail(orderId, trackingInfo, orderData) {
        try {
            // Get user details
            const user = await UserModel.findById(orderData.user || orderData.userId);
            if (!user) {
                // Log error for debugging (remove in production)
                // console.error('User not found for tracking update email:', orderData.user || orderData.userId);
                return { success: false, error: 'User not found' };
            }

            // Prepare order details for email
            const orderDetails = this.prepareOrderDetails(orderData);

            // Get contact information from site settings or environment
            let contactInfo = {};
            try {
                const SiteSettingsModel = (await import('../models/siteSettings.model.js')).default;
                const siteSettings = await SiteSettingsModel.getSettings();
                if (siteSettings.contactInfo) {
                    contactInfo = {
                        email: siteSettings.contactInfo.email || process.env.SUPPORT_EMAIL,
                        phone: siteSettings.contactInfo.phone || process.env.SUPPORT_PHONE,
                        facebook: siteSettings.contactInfo.facebook || process.env.FACEBOOK_URL,
                        instagram: siteSettings.contactInfo.instagram || process.env.INSTAGRAM_URL
                    };
                }
            } catch (settingsError) {
                // Fallback to environment variables if site settings fail
                contactInfo = {
                    email: process.env.SUPPORT_EMAIL,
                    phone: process.env.SUPPORT_PHONE,
                    facebook: process.env.FACEBOOK_URL,
                    instagram: process.env.INSTAGRAM_URL
                };
            }

            const result = await sendEmail({
                sendTo: user.email,
                subject: `Tracking Details Updated - Order #${orderData.orderNumber || orderData.orderId}`,
                html: trackingUpdateEmailTemplate({
                    name: user.name,
                    orderNumber: orderData.orderNumber || orderData.orderId,
                    trackingInfo: trackingInfo,
                    orderDetails: orderDetails,
                    contactInfo: contactInfo
                })
            });

            return result;
        } catch (error) {
            // Log error for debugging (remove in production)
            // console.error('Tracking update email error:', error);
            return { success: false, error: error.message };
        }
    }
}

export default EmailService;
