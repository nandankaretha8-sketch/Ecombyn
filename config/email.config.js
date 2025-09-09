/**
 * Email Configuration for Akshar Art
 * 
 * This file contains configuration and setup instructions for the email system
 * using Resend API for transactional emails.
 */

export const emailConfig = {
    // Resend API Configuration
    resend: {
        apiKey: process.env.RESEND_API,
        fromEmail: process.env.FROM_EMAIL || 'noreply@aksharart.com',
        fromName: process.env.FROM_NAME || 'Akshar Art',
        replyTo: process.env.REPLY_TO_EMAIL || 'support@aksharart.com'
    },

    // Email Templates Configuration
    templates: {
        verification: {
            subject: 'Verify Your Email - Akshar Art',
            template: 'verifyEmailTemplate'
        },
        passwordReset: {
            subject: 'Reset Your Password - Akshar Art',
            template: 'forgotPasswordTemplate'
        },
        orderConfirmation: {
            subject: 'Order Confirmed - Akshar Art',
            template: 'orderStatusEmailTemplate'
        },
        orderStatusUpdate: {
            subject: 'Order Status Update - Akshar Art',
            template: 'orderStatusEmailTemplate'
        },
        welcome: {
            subject: 'Welcome to Akshar Art! 🎨',
            template: 'welcomeEmailTemplate'
        }
    },

    // Email Settings
    settings: {
        // Retry configuration
        maxRetries: 3,
        retryDelay: 1000, // milliseconds
        
        // Rate limiting
        maxEmailsPerMinute: 60,
        maxEmailsPerHour: 1000,
        
        // Email validation
        validateEmail: true,
        
        // Logging
        enableLogging: true,
        logLevel: 'info' // 'debug', 'info', 'warn', 'error'
    },

    // Order Status Email Configuration
    orderStatus: {
        // Statuses that trigger email notifications
        notifyStatuses: [
            'Pending',
            'Confirmed', 
            'Shipped',
            'Out for Delivery',
            'Delivered',
            'Cancelled'
        ],
        
        // Estimated delivery times (in days)
        estimatedDelivery: {
            'Pending': 7,
            'Confirmed': 5,
            'Shipped': 3,
            'Out for Delivery': 1,
            'Delivered': 0,
            'Cancelled': 0
        }
    }
};

/**
 * Environment Variables Required:
 * 
 * RESEND_API=your_resend_api_key_here
 * FROM_EMAIL=noreply@aksharart.com
 * FROM_NAME=Akshar Art
 * REPLY_TO_EMAIL=support@aksharart.com
 * FRONTEND_URL=https://your-frontend-domain.com
 * 
 * Optional:
 * EMAIL_LOG_LEVEL=info
 * EMAIL_MAX_RETRIES=3
 * EMAIL_RATE_LIMIT_PER_MINUTE=60
 */

/**
 * Setup Instructions:
 * 
 * 1. Sign up for Resend (https://resend.com)
 * 2. Get your API key from the Resend dashboard
 * 3. Add the API key to your .env file
 * 4. Configure your domain in Resend (optional but recommended)
 * 5. Test the email system with a test email
 * 
 * Domain Configuration (Recommended):
 * - Add your domain to Resend
 * - Update DNS records as instructed by Resend
 * - Update FROM_EMAIL to use your domain
 * 
 * Testing:
 * - Use Resend's test mode for development
 * - Monitor email delivery in Resend dashboard
 * - Check email logs for any issues
 */

export default emailConfig;
