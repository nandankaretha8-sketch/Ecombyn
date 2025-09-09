import { body, validationResult } from 'express-validator'
import { isValidObjectId } from '../utils/objectIdUtils.js'

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            })),
            error: true,
            success: false
        })
    }
    next()
}

// User registration validation
export const validateRegistration = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name can only contain letters and spaces'),
    
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    
    handleValidationErrors
]

// User login validation
export const validateLogin = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    
    handleValidationErrors
]

// Password reset validation
export const validatePasswordReset = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Password confirmation does not match password')
            }
            return true
        }),
    
    handleValidationErrors
]

// Product validation
export const validateProduct = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Product name must be between 2 and 100 characters')
        .escape(),
    
    body('description')
        .trim()
        .isLength({ min: 10, max: 1000 })
        .withMessage('Description must be between 10 and 1000 characters')
        .escape(),
    
    body('price')
        .isFloat({ min: 0 })
        .withMessage('Price must be a positive number'),
    
    body('stock')
        .isInt({ min: 0 })
        .withMessage('Stock must be a non-negative integer'),
    
    body('discount')
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage('Discount must be between 0 and 100'),
    
    body('category')
        .isArray({ min: 1 })
        .withMessage('At least one category is required'),
    
    body('category.*')
        .custom((value) => {
            if (!isValidObjectId(value)) {
                throw new Error('Invalid category ID format')
            }
            return true
        }),
    
    body('subCategory')
        .isArray({ min: 1 })
        .withMessage('At least one subcategory is required'),
    
    body('subCategory.*')
        .custom((value) => {
            if (!isValidObjectId(value)) {
                throw new Error('Invalid subcategory ID format')
            }
            return true
        }),
    
    handleValidationErrors
]

// Address validation
export const validateAddress = [
    body('address_line')
        .trim()
        .isLength({ min: 5, max: 200 })
        .withMessage('Address must be between 5 and 200 characters')
        .escape(),
    
    body('city')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('City must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('City can only contain letters and spaces'),
    
    body('state')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('State must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('State can only contain letters and spaces'),
    
    body('pincode')
        .isLength({ min: 6, max: 6 })
        .matches(/^\d{6}$/)
        .withMessage('Pincode must be exactly 6 digits'),
    
    body('mobile')
        .isLength({ min: 10, max: 10 })
        .matches(/^\d{10}$/)
        .withMessage('Mobile number must be exactly 10 digits'),
    
    handleValidationErrors
]



// Order validation
export const validateOrder = [
    body('orderItems')
        .isArray({ min: 1 })
        .withMessage('Order must contain at least one item'),
    
    body('orderItems.*.product')
        .custom((value) => {
            if (!isValidObjectId(value)) {
                throw new Error('Invalid product ID format')
            }
            return true
        }),
    
    body('orderItems.*.quantity')
        .isInt({ min: 1 })
        .withMessage('Quantity must be at least 1'),
    
    body('shippingAddress')
        .isObject()
        .withMessage('Shipping address is required'),
    
    body('shippingAddress.fullName')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Full name must be between 2 and 50 characters')
        .escape(),
    
    body('shippingAddress.phone')
        .isLength({ min: 10, max: 10 })
        .matches(/^\d{10}$/)
        .withMessage('Phone number must be exactly 10 digits'),
    
    body('shippingAddress.address')
        .trim()
        .isLength({ min: 5, max: 200 })
        .withMessage('Address must be between 5 and 200 characters')
        .escape(),
    
    body('shippingAddress.city')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('City must be between 2 and 50 characters')
        .escape(),
    
    body('shippingAddress.pincode')
        .isLength({ min: 6, max: 6 })
        .matches(/^\d{6}$/)
        .withMessage('Pincode must be exactly 6 digits'),
    
    body('shippingAddress.state')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('State must be between 2 and 50 characters')
        .escape(),
    
    handleValidationErrors
]

// ObjectId validation middleware
export const validateObjectId = (paramName) => [
    (req, res, next) => {
        const id = req.params[paramName]
        if (!isValidObjectId(id)) {
            return res.status(400).json({
                message: `Invalid ${paramName} format`,
                error: true,
                success: false
            })
        }
        next()
    }
]

// Generic string sanitization
export const sanitizeString = (str) => {
    if (typeof str !== 'string') return str
    return str
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, '') // Remove event handlers
}

// Generic validation for any input
export const validateGenericInput = (fieldName, minLength = 1, maxLength = 100) => [
    body(fieldName)
        .trim()
        .isLength({ min: minLength, max: maxLength })
        .withMessage(`${fieldName} must be between ${minLength} and ${maxLength} characters`)
        .escape(),
    handleValidationErrors
]
