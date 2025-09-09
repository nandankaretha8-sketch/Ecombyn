const orderStatusEmailTemplate = ({ 
    name, 
    orderNumber, 
    status, 
    orderDetails, 
    trackingInfo = null,
    estimatedDelivery = null,
    contactInfo = {}
}) => {
    const { 
        email = process.env.SUPPORT_EMAIL || 'support@aksharart.com',
        phone = process.env.SUPPORT_PHONE || '+91-XXXXXXXXXX'
    } = contactInfo;
    const getStatusConfig = (status) => {
        const configs = {
            'Pending': {
                title: 'Order Confirmed',
                icon: '📋',
                color: '#667eea',
                message: 'Your order has been received and is being processed.',
                actionText: 'View Order Details'
            },
            'Confirmed': {
                title: 'Order Confirmed',
                icon: '✅',
                color: '#28a745',
                message: 'Your order has been confirmed and is being prepared for shipping.',
                actionText: 'Track Your Order'
            },
            'Shipped': {
                title: 'Order Shipped',
                icon: '📦',
                color: '#17a2b8',
                message: 'Great news! Your order has been shipped and is on its way to you.',
                actionText: 'Track Shipment'
            },
            'Out for Delivery': {
                title: 'Out for Delivery',
                icon: '🚚',
                color: '#ffc107',
                message: 'Your order is out for delivery and will be delivered today!',
                actionText: 'Track Delivery'
            },
            'Delivered': {
                title: 'Order Delivered',
                icon: '🎉',
                color: '#28a745',
                message: 'Your order has been successfully delivered!',
                actionText: 'View Order Details'
            },
            'Cancelled': {
                title: 'Order Cancelled',
                icon: '❌',
                color: '#dc3545',
                message: 'Your order has been cancelled as requested.',
                actionText: 'Shop Again'
            }
        };
        return configs[status] || configs['Pending'];
    };

    const config = getStatusConfig(status);
    const orderUrl = `${(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '')}/dashboard/myorders`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.title} - Order #${orderNumber}</title>
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
            background: linear-gradient(135deg, ${config.color} 0%, ${config.color}dd 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .status-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }
        .content {
            padding: 40px 30px;
        }
        .welcome-text {
            font-size: 18px;
            margin-bottom: 20px;
            color: #555;
        }
        .order-number {
            background-color: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            margin: 20px 0;
            font-size: 18px;
            font-weight: bold;
            color: #495057;
        }
        .order-details {
            background-color: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .order-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #e9ecef;
        }
        .order-item:last-child {
            border-bottom: none;
        }
        .item-name {
            font-weight: 500;
            color: #495057;
        }
        .item-price {
            font-weight: bold;
            color: #28a745;
        }
        .total-section {
            border-top: 2px solid #dee2e6;
            margin-top: 15px;
            padding-top: 15px;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
            font-size: 18px;
            color: #495057;
        }
        .action-button {
            display: inline-block;
            background-color: #10b981 !important;
            color: #ffffff !important;
            text-decoration: none !important;
            padding: 15px 30px !important;
            border-radius: 8px !important;
            font-weight: 600 !important;
            font-size: 16px !important;
            margin: 20px 0 !important;
            border: none !important;
            line-height: 1.5 !important;
            cursor: pointer !important;
            -webkit-appearance: none !important;
            -moz-appearance: none !important;
            appearance: none !important;
        }
        .action-button:hover {
            background-color: #059669 !important;
        }
        .tracking-info {
            background-color: #e3f2fd;
            border: 1px solid #bbdefb;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .tracking-number {
            font-weight: bold;
            color: #1976d2;
            font-size: 16px;
        }
        .delivery-estimate {
            background-color: #fff3e0;
            border: 1px solid #ffcc02;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            text-align: center;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .contact-info {
            background-color: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎨 Akshar Art</div>
            <div class="status-icon">${config.icon}</div>
            <h1>${config.title}</h1>
        </div>
        
        <div class="content">
            <p class="welcome-text">Hello ${name},</p>
            
            <p style="font-size: 16px; margin-bottom: 20px; color: #666;">
                ${config.message}
            </p>
            
            <div class="order-number">
                Order #${orderNumber}
            </div>
            
            <div class="order-details">
                <h3 style="margin-top: 0; color: #495057;">Order Summary</h3>
                ${orderDetails.map(item => `
                    <div class="order-item">
                        <span class="item-name">${item.name} × ${item.quantity}</span>
                        <span class="item-price">₹${item.price}</span>
                    </div>
                `).join('')}
                <div class="total-section">
                    <div class="total-row">
                        <span>Total Amount:</span>
                        <span>₹${orderDetails.reduce((sum, item) => sum + (item.price * item.quantity), 0)}</span>
                    </div>
                </div>
            </div>
            
            ${trackingInfo ? `
                <div class="tracking-info">
                    <h3 style="margin-top: 0; color: #1976d2;">📦 Tracking Information</h3>
                    <p><strong>Courier:</strong> ${trackingInfo.partner}</p>
                    <p><strong>Tracking Number:</strong> <span class="tracking-number">${trackingInfo.trackingNumber}</span></p>
                    ${trackingInfo.url ? `<p><strong>Track Online:</strong> <a href="${trackingInfo.url}" style="color: #1976d2;">Click here to track</a></p>` : ''}
                </div>
            ` : ''}
            
            ${estimatedDelivery ? `
                <div class="delivery-estimate">
                    <strong>📅 Estimated Delivery:</strong> ${estimatedDelivery}
                </div>
            ` : ''}
            
            <div style="text-align: center;">
                <a href="${orderUrl}" 
                   class="action-button"
                   style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; text-align: center; border: none; font-size: 16px; line-height: 1.5;">
                    ${config.actionText}
                </a>
            </div>
            
            <div class="contact-info">
                <h3 style="margin-top: 0; color: #495057;">Need Help?</h3>
                <p>If you have any questions about your order, please don't hesitate to contact us:</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Phone:</strong> ${phone}</p>
            </div>
        </div>
        
        <div class="footer">
            <p>© 2024 Akshar Art. All rights reserved.</p>
            <p>Thank you for choosing Akshar Art for your artistic needs!</p>
        </div>
    </div>
</body>
</html>
    `;
};

export default orderStatusEmailTemplate;
