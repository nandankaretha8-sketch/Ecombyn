import express from 'express'
import auth from '../middleware/auth.js'
import { admin as Admin } from '../middleware/Admin.js'
import {
  getActiveHomeLayout,
  getAllHomeLayouts,
  createHomeLayout,
  updateHomeLayout,
  deleteHomeLayout,
  activateHomeLayout,
  getAvailableCategories,
  duplicateHomeLayout
} from '../controllers/homeLayout.controller.js'

const router = express.Router()

// Public route - get active layout (for frontend)
router.get('/active', getActiveHomeLayout)

// Admin routes - require authentication and admin privileges
router.get('/all', auth, Admin, getAllHomeLayouts)
router.post('/create', auth, Admin, createHomeLayout)
router.put('/update/:layoutId', auth, Admin, updateHomeLayout)
router.delete('/delete/:layoutId', auth, Admin, deleteHomeLayout)
router.put('/activate/:layoutId', auth, Admin, activateHomeLayout)
router.get('/categories', auth, Admin, getAvailableCategories)
router.post('/duplicate/:layoutId', auth, Admin, duplicateHomeLayout)

export default router
