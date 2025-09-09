import express from 'express'
import { 
  getAllBanners, 
  getActiveBanners, 
  getBetweenCategoryBanners,
  createBanner, 
  updateBanner, 
  deleteBanner, 
  toggleBannerStatus, 
  reorderBanners, 
  getBannerById 
} from '../controllers/banner.controller.js'
import auth from '../middleware/auth.js'
import { admin } from '../middleware/Admin.js'

const router = express.Router()

// Public routes
router.get('/active', getActiveBanners)
router.get('/between-categories', getBetweenCategoryBanners)
router.get('/:id', getBannerById)

// Admin routes (require authentication and admin privileges)
router.get('/', auth, admin, getAllBanners)
router.post('/', auth, admin, createBanner)
router.put('/:id', auth, admin, updateBanner)
router.delete('/:id', auth, admin, deleteBanner)
router.patch('/:id/toggle', auth, admin, toggleBannerStatus)
router.put('/reorder', auth, admin, reorderBanners)

export default router
