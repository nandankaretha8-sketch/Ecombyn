// Security configuration for the application

export const securityConfig = {
    // Password requirements
    password: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxLength: 128
    },

    // JWT settings
    jwt: {
        accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || '15m', // 15 minutes
        refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '7d', // 7 days
        algorithm: 'HS256'
    },

    // Rate limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
        authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 5, // limit auth attempts to 5 per windowMs
        message: {
            error: true,
            message: 'Too many requests from this IP, please try again later.',
            success: false
        }
    },

    // CORS settings
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    },

    // Cookie settings
    cookies: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },

    // File upload limits
    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        maxFiles: parseInt(process.env.MAX_FILES) || 10
    },

    // Input validation limits
    validation: {
        name: { min: 2, max: 50 },
        email: { max: 100 },
        description: { min: 10, max: 1000 },
        comment: { min: 10, max: 500 },
        address: { min: 5, max: 200 },
        city: { min: 2, max: 50 },
        state: { min: 2, max: 50 },
        pincode: { exact: 6 },
        mobile: { exact: 10 }
    },

    // Security headers
    headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    },

    // Content Security Policy
    csp: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'", process.env.FRONTEND_URL],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    },

    // Session security
    session: {
        secret: process.env.SESSION_SECRET || 'your-session-secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
    },

    // CSRF protection
    csrf: {
        enabled: true,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        }
    }
}

// Password validation function
export const validatePassword = (password) => {
    const { minLength, requireUppercase, requireLowercase, requireNumbers, requireSpecialChars } = securityConfig.password
    
    if (password.length < minLength) {
        return { valid: false, message: `Password must be at least ${minLength} characters long` }
    }
    
    if (requireUppercase && !/[A-Z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one uppercase letter' }
    }
    
    if (requireLowercase && !/[a-z]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one lowercase letter' }
    }
    
    if (requireNumbers && !/\d/.test(password)) {
        return { valid: false, message: 'Password must contain at least one number' }
    }
    
    if (requireSpecialChars && !/[@$!%*?&]/.test(password)) {
        return { valid: false, message: 'Password must contain at least one special character (@$!%*?&)' }
    }
    
    return { valid: true }
}

// Input sanitization function
export const sanitizeInput = (input, type = 'string') => {
    if (typeof input !== 'string') return input
    
    let sanitized = input.trim()
    
    switch (type) {
        case 'email':
            sanitized = sanitized.toLowerCase()
            break
        case 'name':
            sanitized = sanitized.replace(/[^a-zA-Z\s]/g, '')
            break
        case 'phone':
            sanitized = sanitized.replace(/\D/g, '')
            break
        case 'pincode':
            sanitized = sanitized.replace(/\D/g, '')
            break
        default:
            // Remove potential XSS vectors
            sanitized = sanitized
                .replace(/[<>]/g, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+=/gi, '')
    }
    
    return sanitized
}

// Rate limiting configuration
export const createRateLimiter = (max, windowMs = 15 * 60 * 1000) => {
    const store = new Map()
    
    return (req, res, next) => {
        const ip = req.ip
        const now = Date.now()
        const windowStart = now - windowMs
        
        if (!store.has(ip)) {
            store.set(ip, [])
        }
        
        const requests = store.get(ip).filter(time => time > windowStart)
        requests.push(now)
        store.set(ip, requests)
        
        if (requests.length > max) {
            return res.status(429).json({
                error: true,
                message: 'Too many requests, please try again later.',
                success: false
            })
        }
        
        next()
    }
}

// Security middleware factory
export const createSecurityMiddleware = () => {
    return {
        validatePassword,
        sanitizeInput,
        createRateLimiter,
        config: securityConfig
    }
}
