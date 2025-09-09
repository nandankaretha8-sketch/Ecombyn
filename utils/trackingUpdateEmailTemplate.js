/**
 * Tracking Update Email Template
 * 
 * This template is used when admin updates tracking details for an order
 */

const trackingUpdateEmailTemplate = ({ name, orderNumber, trackingInfo, orderDetails, contactInfo = {} }) => {
    const { partner, trackingNumber, url } = trackingInfo;
    const { 
        email = process.env.SUPPORT_EMAIL || 'support@aksharart.com',
        phone = process.env.SUPPORT_PHONE || '+91 1234567890',
        facebook = process.env.FACEBOOK_URL || '#',
        instagram = process.env.INSTAGRAM_URL || '#'
    } = contactInfo;
    
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tracking Details Updated - Order #${orderNumber}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f8f9fa;
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
                padding: 30px 20px;
                text-align: center;
            }
            
            .header h1 {
                font-size: 24px;
                margin-bottom: 10px;
                font-weight: 600;
            }
            
            .header p {
                font-size: 16px;
                opacity: 0.9;
            }
            
            .content {
                padding: 30px 20px;
            }
            
            .greeting {
                font-size: 18px;
                margin-bottom: 20px;
                color: #2d3748;
            }
            
            .order-info {
                background-color: #f7fafc;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 25px;
                border-left: 4px solid #667eea;
            }
            
            .order-number {
                font-size: 20px;
                font-weight: 600;
                color: #2d3748;
                margin-bottom: 10px;
            }
            
            .tracking-section {
                background-color: #e6fffa;
                border: 1px solid #81e6d9;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 25px;
            }
            
            .tracking-title {
                font-size: 18px;
                font-weight: 600;
                color: #2c7a7b;
                margin-bottom: 15px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .tracking-details {
                display: grid;
                gap: 12px;
            }
            
            .tracking-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px;
                background-color: white;
                border-radius: 6px;
                border: 1px solid #e2e8f0;
            }
            
            .tracking-label {
                font-weight: 600;
                color: #4a5568;
                min-width: 120px;
            }
            
            .tracking-value {
                color: #2d3748;
                flex: 1;
            }
            
            .track-button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-decoration: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-weight: 600;
                margin-top: 15px;
                transition: transform 0.2s;
            }
            
            .track-button:hover {
                transform: translateY(-2px);
            }
            
            .order-summary {
                background-color: #f7fafc;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 25px;
            }
            
            .summary-title {
                font-size: 16px;
                font-weight: 600;
                color: #2d3748;
                margin-bottom: 15px;
            }
            
            .order-items {
                display: grid;
                gap: 10px;
            }
            
            .order-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px;
                background-color: white;
                border-radius: 6px;
                border: 1px solid #e2e8f0;
            }
            
            .item-name {
                font-weight: 500;
                color: #2d3748;
            }
            
            .item-details {
                text-align: right;
                color: #4a5568;
            }
            
            .footer {
                background-color: #2d3748;
                color: white;
                padding: 20px;
                text-align: center;
            }
            
            .footer p {
                margin-bottom: 10px;
                opacity: 0.9;
            }
            
            .contact-info {
                font-size: 14px;
                opacity: 0.8;
            }
            
            .social-links {
                margin-top: 15px;
            }
            
            .social-links a {
                color: white;
                text-decoration: none;
                margin: 0 10px;
                opacity: 0.8;
                transition: opacity 0.2s;
            }
            
            .social-links a:hover {
                opacity: 1;
            }
            
            @media (max-width: 600px) {
                .container {
                    margin: 10px;
                    border-radius: 0;
                }
                
                .header {
                    padding: 20px 15px;
                }
                
                .content {
                    padding: 20px 15px;
                }
                
                .tracking-item {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 5px;
                }
                
                            .tracking-label {
                min-width: auto;
            }
            
            .track-button {
                display: inline-block;
                background-color: #10b981 !important;
                color: #ffffff !important;
                padding: 8px 16px !important;
                text-decoration: none !important;
                border-radius: 6px !important;
                font-weight: 600 !important;
                font-size: 14px !important;
                border: none !important;
                line-height: 1.5 !important;
                cursor: pointer !important;
                -webkit-appearance: none !important;
                -moz-appearance: none !important;
                appearance: none !important;
            }
            
            .track-button:hover {
                background-color: #059669 !important;
            }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📦 Tracking Details Updated</h1>
                <p>Your order is now trackable!</p>
            </div>
            
            <div class="content">
                <div class="greeting">
                    Hello ${name},
                </div>
                
                <div class="order-info">
                    <div class="order-number">Order #${orderNumber}</div>
                    <p>Great news! We've updated the tracking details for your order. You can now track your package in real-time.</p>
                </div>
                
                <div class="tracking-section">
                    <div class="tracking-title">
                        🚚 Tracking Information
                    </div>
                    <div class="tracking-details">
                        <div class="tracking-item">
                            <span class="tracking-label">Courier Partner:</span>
                            <span class="tracking-value">${partner || 'Not specified'}</span>
                        </div>
                        <div class="tracking-item">
                            <span class="tracking-label">Tracking Number:</span>
                            <span class="tracking-value">${trackingNumber || 'Not available'}</span>
                        </div>
                        ${url ? `
                        <div class="tracking-item">
                            <span class="tracking-label">Track Online:</span>
                            <span class="tracking-value">
                                <a href="${url}" 
                                   class="track-button" 
                                   target="_blank" 
                                   style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; border: none;">
                                    Track Package
                                </a>
                            </span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="order-summary">
                    <div class="summary-title">📋 Order Summary</div>
                    <div class="order-items">
                        ${orderDetails.map(item => `
                            <div class="order-item">
                                <span class="item-name">${item.name}</span>
                                <span class="item-details">Qty: ${item.quantity} × ₹${item.price}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                    <h3 style="color: #856404; margin-bottom: 10px;">💡 Tracking Tips:</h3>
                    <ul style="color: #856404; margin-left: 20px;">
                        <li>Tracking information may take 24-48 hours to appear</li>
                        <li>Contact us if you have any questions about your delivery</li>
                        <li>Make sure someone is available to receive the package</li>
                    </ul>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                    <p style="color: #4a5568; margin-bottom: 15px;">
                        Thank you for choosing us! We're committed to providing you with the best shopping experience.
                    </p>
                    <p style="color: #4a5568;">
                        If you have any questions, please don't hesitate to contact our customer support.
                    </p>
                </div>
            </div>
            
            <div class="footer">
                <p>Best regards,</p>
                <p><strong>Akshar Art Team</strong></p>
                <div class="contact-info">
                    <p>📧 ${email}</p>
                    <p>📞 ${phone}</p>
                </div>
                <div class="social-links">
                    <a href="${facebook}">Facebook</a> |
                    <a href="${instagram}">Instagram</a>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
};

export default trackingUpdateEmailTemplate;
