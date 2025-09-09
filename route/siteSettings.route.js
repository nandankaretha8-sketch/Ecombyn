import express from 'express'
import { getSiteSettings, updateSiteSettings, updateSection, getCODSettings, getProductSettings } from '../controllers/siteSettings.controller.js'
import auth from '../middleware/auth.js'
import { admin } from '../middleware/Admin.js'

const router = express.Router()

// Get site settings (public)
router.get('/get', getSiteSettings)

// Get COD settings only (public)
router.get('/cod-settings', getCODSettings)

// Get product settings only (public)
router.get('/product-settings', getProductSettings)

// Update site settings (admin only)
router.put('/update', auth, admin, updateSiteSettings)

// Update specific section (admin only)
router.put('/update-section', auth, admin, updateSection)

export default router
