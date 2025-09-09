import { Router } from 'express';
import auth from '../middleware/auth.js';
import { admin } from '../middleware/Admin.js';
import {
    createUGCVideo,
    getAllUGCVideos,
    getApprovedUGCVideos,
    updateUGCVideo,
    deleteUGCVideo,
    toggleVideoApproval,
    getUGCVideoById,
    assignProductToVideo
} from '../controllers/ugcVideo.controller.js';

const router = Router();

// Public routes
router.get('/approved', getApprovedUGCVideos);
router.get('/:id', getUGCVideoById);

// Admin routes (protected)
router.post('/', auth, admin, createUGCVideo);
router.get('/', auth, admin, getAllUGCVideos);
router.put('/:id', auth, admin, updateUGCVideo);
router.delete('/:id', auth, admin, deleteUGCVideo);
router.patch('/:id/approval', auth, admin, toggleVideoApproval);
router.patch('/:id/assign-product', auth, admin, assignProductToVideo);

export default router;
