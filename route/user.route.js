import { Router } from 'express'
import { forgotPasswordController, loginController, logoutController, refreshToken, registerUserController, resetpassword, updateUserDetails, uploadAvatar, userDetails, verifyEmailController, verifyForgotPasswordOtp, setupTwoFactor, verifyTwoFactor, disableTwoFactor, verifyBackupCode, verify2FALogin, adminListUsers } from '../controllers/user.controller.js'
import auth from '../middleware/auth.js'
import upload from '../middleware/multer.js'
import { admin } from '../middleware/Admin.js'
import { validateRegistration, validateLogin, validatePasswordReset } from '../middleware/validation.js'

const userRouter = Router()

userRouter.post('/register', validateRegistration, registerUserController)
userRouter.post('/verify-email', verifyEmailController)
userRouter.post('/login', validateLogin, loginController)
userRouter.post('/logout', auth, logoutController)
userRouter.post('/forgot-password', forgotPasswordController)
userRouter.post('/verify-forgot-password-otp', verifyForgotPasswordOtp)
userRouter.post('/reset-password', validatePasswordReset, resetpassword)
userRouter.post('/refresh-token', refreshToken)
userRouter.get('/user-details', auth, userDetails)
userRouter.put('/update-user-details', auth, updateUserDetails)
userRouter.post('/upload-avatar', auth, upload.single("image"), uploadAvatar)

// 2FA Routes
userRouter.post('/2fa/setup', auth, setupTwoFactor)
userRouter.post('/2fa/verify', auth, verifyTwoFactor)
userRouter.post('/2fa/disable', auth, disableTwoFactor)
userRouter.post('/2fa/backup-verify', verifyBackupCode)
userRouter.post('/2fa/login-verify', verify2FALogin)

// Admin routes
userRouter.get('/admin/users', auth, admin, adminListUsers)

export default userRouter