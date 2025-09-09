import { Router } from 'express'
import auth from '../middleware/auth.js'
import { admin } from '../middleware/Admin.js'
import { createOrder, getMyOrders, getAllOrders, updateStatus, cancelMyOrder, updateOrderAddress, updateTracking, createPaymentSession, webhookRazorpayV2, cleanupOrderNumbers, getOrderStatusHistory } from '../controllers/orderV2.controller.js'

const router = Router()

// POST /api/orders - create order
router.post('/', auth, createOrder)

// POST /api/orders/payment - create payment session
router.post('/payment', auth, createPaymentSession)

// POST /api/orders/webhook - razorpay webhook (commented out for test mode)
// router.post('/webhook', webhookRazorpayV2)

// POST /api/orders/cleanup - cleanup null order numbers (admin only)
router.post('/cleanup', auth, admin, cleanupOrderNumbers)

// GET /api/orders/myorders - my orders
router.get('/myorders', auth, getMyOrders)

// GET /api/orders - all orders (admin)
router.get('/', auth, admin, getAllOrders)

// PUT /api/orders/:id/status - admin update status
router.put('/:id/status', auth, admin, updateStatus)

// PUT /api/orders/:id/cancel - user cancel their order
router.put('/:id/cancel', auth, cancelMyOrder)

// PUT /api/orders/:id/address - user updates shipping address before shipping
router.put('/:id/address', auth, updateOrderAddress)

// PUT /api/orders/:id/tracking - admin adds tracking details
router.put('/:id/tracking', auth, admin, updateTracking)

// GET /api/orders/:id/status-history - get order status history
router.get('/:id/status-history', auth, getOrderStatusHistory)

export default router

