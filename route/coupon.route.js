import { Router } from 'express'
import auth from '../middleware/auth.js'
import { admin } from '../middleware/Admin.js'
import { 
    createCoupon, 
    getAllCoupons, 
    validateCoupon, 
    updateCoupon, 
    deleteCoupon,
    getEligibleCoupons,
    getAllCouponsForUser
} from '../controllers/coupon.controller.js'
import CouponModel from '../models/coupon.model.js'

const couponRouter = Router()



// Admin routes
couponRouter.post('/', auth, admin, createCoupon)
couponRouter.get('/', auth, admin, getAllCoupons)
couponRouter.put('/:id', auth, admin, updateCoupon)
couponRouter.delete('/:id', auth, admin, deleteCoupon)

// User routes
couponRouter.get('/eligible', getEligibleCoupons) // Removed auth middleware
couponRouter.get('/all', auth, getAllCouponsForUser) // Get all coupons including used ones
couponRouter.post('/validate/:code', auth, validateCoupon)

export default couponRouter
