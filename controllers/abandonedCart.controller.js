import CartProductModel from "../models/cartproduct.model.js";
import UserModel from "../models/user.model.js";
import ProductModel from "../models/product.model.js";
import sendEmail from "../config/sendEmail.js";

/**
 * Send abandoned cart recovery email to a specific user
 */
export const sendAbandonedCartEmail = async (req, res) => {
    try {
        const { userId, emailType = 'reminder' } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required',
                error: true
            });
        }

        // Get user details
        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                error: true
            });
        }

        // Get user's abandoned cart items
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const cartItems = await CartProductModel.find({
            userId: userId,
            updatedAt: { $lt: sixHoursAgo }
        }).populate('productId');

        if (!cartItems || cartItems.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No abandoned cart items found for this user',
                error: true
            });
        }

        // Calculate cart total
        const cartTotal = cartItems.reduce((total, item) => {
            return total + (item.productId?.price || 0) * item.quantity;
        }, 0);

        // Prepare email content
        const emailContent = generateAbandonedCartEmail({
            userName: user.name,
            cartItems: cartItems.map(item => ({
                name: item.productId?.name || 'Unknown Product',
                price: item.productId?.price || 0,
                quantity: item.quantity,
                image: item.productId?.image || ''
            })),
            cartTotal: cartTotal,
            emailType: emailType
        });

        // Send email
        const emailResult = await sendEmail({
            sendTo: user.email,
            subject: emailContent.subject,
            html: emailContent.html
        });

        if (emailResult.success) {
            // Log the email sent
            // Log for debugging (remove in production)
            // console.log(`Abandoned cart email sent to ${user.email} for user ${userId}`);
            
            res.json({
                success: true,
                message: 'Abandoned cart email sent successfully',
                data: {
                    userEmail: user.email,
                    userName: user.name,
                    cartItemsCount: cartItems.length,
                    cartTotal: cartTotal
                }
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send abandoned cart email',
                error: emailResult.error
            });
        }

    } catch (error) {
        // Log error for debugging (remove in production)
        // console.error('Send abandoned cart email error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send abandoned cart email',
            error: error.message
        });
    }
};

/**
 * Send bulk abandoned cart emails to multiple users
 */
export const sendBulkAbandonedCartEmails = async (req, res) => {
    try {
        const { userIds = [], emailType = 'reminder' } = req.body;

        if (!userIds || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'User IDs array is required',
                error: true
            });
        }

        const results = [];
        const errors = [];

        // Process each user
        for (const userId of userIds) {
            try {
                // Get user details
                const user = await UserModel.findById(userId);
                if (!user) {
                    errors.push({ userId, error: 'User not found' });
                    continue;
                }

                // Get user's abandoned cart items
                const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
                const cartItems = await CartProductModel.find({
                    userId: userId,
                    updatedAt: { $lt: sixHoursAgo }
                }).populate('productId');

                if (!cartItems || cartItems.length === 0) {
                    errors.push({ userId, error: 'No abandoned cart items found' });
                    continue;
                }

                // Calculate cart total
                const cartTotal = cartItems.reduce((total, item) => {
                    return total + (item.productId?.price || 0) * item.quantity;
                }, 0);

                // Prepare email content
                const emailContent = generateAbandonedCartEmail({
                    userName: user.name,
                    cartItems: cartItems.map(item => ({
                        name: item.productId?.name || 'Unknown Product',
                        price: item.productId?.price || 0,
                        quantity: item.quantity,
                        image: item.productId?.image || ''
                    })),
                    cartTotal: cartTotal,
                    emailType: emailType
                });

                // Send email
                const emailResult = await sendEmail({
                    sendTo: user.email,
                    subject: emailContent.subject,
                    html: emailContent.html
                });

                if (emailResult.success) {
                    results.push({
                        userId,
                        userEmail: user.email,
                        userName: user.name,
                        cartItemsCount: cartItems.length,
                        cartTotal: cartTotal,
                        status: 'sent'
                    });
                } else {
                    errors.push({ userId, error: emailResult.error });
                }

                // Add delay to prevent rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                errors.push({ userId, error: error.message });
            }
        }

        res.json({
            success: true,
            message: `Bulk email operation completed. ${results.length} emails sent, ${errors.length} failed.`,
            data: {
                totalProcessed: userIds.length,
                successful: results.length,
                failed: errors.length,
                results: results,
                errors: errors
            }
        });

    } catch (error) {
        // Log error for debugging (remove in production)
        // console.error('Bulk abandoned cart email error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send bulk abandoned cart emails',
            error: error.message
        });
    }
};

/**
 * Generate abandoned cart email HTML content
 */
const generateAbandonedCartEmail = ({ userName, cartItems, cartTotal, emailType }) => {
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const getEmailSubject = (type) => {
        switch (type) {
            case 'reminder':
                return 'Complete Your Purchase - Items Waiting in Your Cart!';
            case 'urgent':
                return 'Last Chance! Your Cart Items Are About to Expire';
            case 'discount':
                return 'Special Offer - Complete Your Purchase with 10% Off!';
            default:
                return 'Don\'t Forget Your Cart Items!';
        }
    };

    const getEmailContent = (type) => {
        switch (type) {
            case 'reminder':
                return `
                    <p>Hi ${userName},</p>
                    <p>We noticed you have some amazing items in your cart that you haven't completed yet. Don't let them slip away!</p>
                `;
            case 'urgent':
                return `
                    <p>Hi ${userName},</p>
                    <p>⏰ Time is running out! Your cart items are about to expire. Complete your purchase now before they're gone!</p>
                `;
            case 'discount':
                return `
                    <p>Hi ${userName},</p>
                    <p>🎉 Special offer just for you! Complete your purchase now and get 10% off your entire order!</p>
                    <p><strong>Use code: CART10</strong></p>
                `;
            default:
                return `
                    <p>Hi ${userName},</p>
                    <p>You have some great items waiting in your cart. Complete your purchase to get them delivered to your doorstep!</p>
                `;
        }
    };

    const subject = getEmailSubject(emailType);
    const emailContent = getEmailContent(emailType);

    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Complete Your Purchase</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f4f4f4;
                }
                .container {
                    background-color: #ffffff;
                    border-radius: 10px;
                    padding: 30px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .logo {
                    font-size: 24px;
                    font-weight: bold;
                    color: #2563eb;
                    margin-bottom: 10px;
                }
                .cart-items {
                    background-color: #f8f9fa;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                }
                .cart-item {
                    display: flex;
                    align-items: center;
                    padding: 15px 0;
                    border-bottom: 1px solid #e9ecef;
                }
                .cart-item:last-child {
                    border-bottom: none;
                }
                .item-image {
                    width: 60px;
                    height: 60px;
                    object-fit: cover;
                    border-radius: 8px;
                    margin-right: 15px;
                }
                .item-details {
                    flex: 1;
                }
                .item-name {
                    font-weight: 600;
                    margin-bottom: 5px;
                }
                .item-price {
                    color: #2563eb;
                    font-weight: 600;
                }
                .item-quantity {
                    color: #6c757d;
                    font-size: 14px;
                }
                .cart-total {
                    background-color: #2563eb;
                    color: white;
                    padding: 20px;
                    border-radius: 8px;
                    text-align: center;
                    margin: 20px 0;
                }
                .total-amount {
                    font-size: 24px;
                    font-weight: bold;
                }
                .cta-button {
                    display: inline-block;
                    background-color: #10b981 !important;
                    color: #ffffff !important;
                    padding: 15px 30px !important;
                    text-decoration: none !important;
                    border-radius: 8px !important;
                    font-weight: 600 !important;
                    margin: 20px 0 !important;
                    text-align: center !important;
                    border: none !important;
                    font-size: 16px !important;
                    line-height: 1.5 !important;
                    cursor: pointer !important;
                    -webkit-appearance: none !important;
                    -moz-appearance: none !important;
                    appearance: none !important;
                }
                .cta-button:hover {
                    background-color: #059669 !important;
                }
                .footer {
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e9ecef;
                    color: #6c757d;
                    font-size: 14px;
                }
                .social-links {
                    margin-top: 15px;
                }
                .social-links a {
                    color: #2563eb;
                    text-decoration: none;
                    margin: 0 10px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🛒 Akshar Art</div>
                    <h1 style="color: #2563eb; margin: 0;">Complete Your Purchase</h1>
                </div>

                ${emailContent}

                <div class="cart-items">
                    <h3 style="margin-top: 0; color: #495057;">Your Cart Items:</h3>
                    ${cartItems.map(item => `
                        <div class="cart-item">
                            <img src="${item.image}" alt="${item.name}" class="item-image" onerror="this.style.display='none'">
                            <div class="item-details">
                                <div class="item-name">${item.name}</div>
                                <div class="item-price">${formatCurrency(item.price)}</div>
                                <div class="item-quantity">Quantity: ${item.quantity}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="cart-total">
                    <div>Total Cart Value:</div>
                    <div class="total-amount">${formatCurrency(cartTotal)}</div>
                </div>

                <div style="text-align: center;">
                    <a href="${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/cart" 
                       class="cta-button"
                       style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; text-align: center; border: none; font-size: 16px; line-height: 1.5;">
                        Complete Your Purchase
                    </a>
                </div>

                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h4 style="margin-top: 0; color: #495057;">Why complete your purchase?</h4>
                    <ul style="margin: 0; padding-left: 20px;">
                        <li>✅ Secure checkout with multiple payment options</li>
                        <li>🚚 Fast and reliable delivery</li>
                        <li>🛡️ 100% secure and protected</li>
                        <li>💯 Quality guaranteed products</li>
                    </ul>
                </div>

                <div class="footer">
                    <p>If you have any questions, please don't hesitate to contact us:</p>
                    <p>📧 ${process.env.SUPPORT_EMAIL || 'support@aksharart.com'}</p>
                    <p>📞 ${process.env.SUPPORT_PHONE || '+91-XXXXXXXXXX'}</p>
                    
                    <div class="social-links">
                        <a href="${process.env.FACEBOOK_URL || '#'}">Facebook</a> |
                        <a href="${process.env.INSTAGRAM_URL || '#'}">Instagram</a>
                    </div>
                    
                    <p style="margin-top: 20px; font-size: 12px;">
                        This email was sent because you have items in your cart. 
                        If you've already completed your purchase, please ignore this email.
                    </p>
                </div>
            </div>
        </body>
        </html>
    `;

    return { subject, html };
};
