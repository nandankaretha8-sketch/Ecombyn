const forgotPasswordTemplate = ({ name, otp })=>{
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password - Akshar Art</title>
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
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .content {
            padding: 40px 30px;
        }
        .welcome-text {
            font-size: 18px;
            margin-bottom: 20px;
            color: #555;
        }
        .description {
            font-size: 16px;
            margin-bottom: 30px;
            color: #666;
        }
        .otp-container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 25px;
            border-radius: 10px;
            text-align: center;
            margin: 30px 0;
        }
        .otp-code {
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 5px;
            margin: 10px 0;
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
        .security-note {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
            font-size: 14px;
            color: #856404;
        }
        .expiry-note {
            background-color: #d1ecf1;
            border: 1px solid #bee5eb;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
            font-size: 14px;
            color: #0c5460;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎨 Akshar Art</div>
            <h1>Password Reset Request</h1>
        </div>
        
        <div class="content">
            <p class="welcome-text">Hello ${name},</p>
            
            <p class="description">
                We received a request to reset your password for your Akshar Art account. 
                To proceed with the password reset, please use the verification code below.
            </p>
            
            <div class="otp-container">
                <div style="font-size: 16px; margin-bottom: 10px;">Your Verification Code</div>
                <div class="otp-code">${otp}</div>
                <div style="font-size: 14px; opacity: 0.9;">Enter this code on the password reset page</div>
            </div>
            
            <div class="expiry-note">
                <strong>⏰ Important:</strong> This verification code will expire in 5 minutes for your security.
            </div>
            
            <div class="security-note">
                <strong>🔒 Security Note:</strong> If you didn't request a password reset, please ignore this email. 
                Your account security is important to us.
            </div>
            
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
                If you're having trouble with the verification code, you can request a new one from your account settings.
            </p>
        </div>
        
        <div class="footer">
            <p>© 2024 Akshar Art. All rights reserved.</p>
            <p>This email was sent to you because you requested a password reset for your Akshar Art account.</p>
        </div>
    </div>
</body>
</html>
    `
}

export default forgotPasswordTemplate