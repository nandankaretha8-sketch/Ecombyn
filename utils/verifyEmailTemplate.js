const verifyEmailTemplate = ({name, url})=>{
    return`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email - Akshar Art</title>
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
        .verify-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 15px 30px;
            border-radius: 25px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            transition: transform 0.2s ease;
        }
        .verify-button:hover {
            transform: translateY(-2px);
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
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎨 Akshar Art</div>
            <h1>Welcome to Akshar Art!</h1>
        </div>
        
        <div class="content">
            <p class="welcome-text">Hello ${name},</p>
            
            <p class="description">
                Thank you for registering with Akshar Art! We're excited to have you as part of our community. 
                To complete your registration and start exploring our beautiful collection of art and crafts, 
                please verify your email address by clicking the button below.
            </p>
            
            <div style="text-align: center;">
                <a href="${url}" class="verify-button">Verify Email Address</a>
            </div>
            
            <div class="security-note">
                <strong>🔒 Security Note:</strong> This verification link will expire in 24 hours for your security. 
                If you didn't create an account with Akshar Art, please ignore this email.
            </div>
            
            <p style="margin-top: 30px; color: #666; font-size: 14px;">
                If the button above doesn't work, you can copy and paste this link into your browser:<br>
                <a href="${url}" style="color: #667eea; word-break: break-all;">${url}</a>
            </p>
        </div>
        
        <div class="footer">
            <p>© 2024 Akshar Art. All rights reserved.</p>
            <p>This email was sent to you because you registered for an account with Akshar Art.</p>
        </div>
    </div>
</body>
</html>
`
}

export default verifyEmailTemplate