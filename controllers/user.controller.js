import EmailService from '../utils/emailService.js'
import UserModel from '../models/user.model.js'
import bcryptjs from 'bcryptjs'
import generatedAccessToken from '../utils/generatedAccessToken.js'
import genertedRefreshToken from '../utils/generatedRefreshToken.js'
import uploadImageCloudinary from '../utils/uploadImageClodinary.js'
import generatedOtp from '../utils/generatedOtp.js'
import jwt from 'jsonwebtoken'
import { sanitizeString } from '../middleware/validation.js'
import { generateTwoFactorSecret, verifyTwoFactorToken, generateBackupCodes, verifyBackupCode as verifyBackupCodeUtil, requiresTwoFactor, isValidToken, isValidBackupCode } from "../utils/twoFactorUtils.js"

// Admin: list all users (excluding sensitive fields)
export async function adminListUsers(request, response) {
    try {
        const { page = 1, limit = 50, search = '' } = request.query
        const numericPage = Math.max(parseInt(page) || 1, 1)
        const numericLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200)

        const filter = {}
        if (search) {
            const term = String(search).trim()
            filter.$or = [
                { name: { $regex: term, $options: 'i' } },
                { email: { $regex: term, $options: 'i' } },
                { mobile: { $regex: term, $options: 'i' } }
            ]
        }

        const [users, total] = await Promise.all([
            UserModel.find(filter)
                .select('-password -twoFactorSecret -twoFactorBackupCodes')
                .sort({ createdAt: -1 })
                .skip((numericPage - 1) * numericLimit)
                .limit(numericLimit),
            UserModel.countDocuments(filter)
        ])

        return response.json({
            success: true,
            error: false,
            message: 'Users fetched successfully',
            data: {
                users,
                page: numericPage,
                limit: numericLimit,
                total,
                totalPages: Math.ceil(total / numericLimit)
            }
        })
    } catch (error) {
        return response.status(500).json({
            message: 'Failed to fetch users',
            error: true,
            success: false
        })
    }
}

export async function registerUserController(request,response){
    try {
        const { name, email , password } = request.body

        // Additional server-side validation
        if(!name || !email || !password){
            return response.status(400).json({
                message : "Provide email, name, password",
                error : true,
                success : false
            })
        }

        // Sanitize inputs
        const sanitizedName = sanitizeString(name)
        const sanitizedEmail = email.toLowerCase().trim()

        // Check for existing user
        const user = await UserModel.findOne({ email: sanitizedEmail })

        if(user){
            return response.status(400).json({
                message : "Email already registered",
                error : true,
                success : false
            })
        }

        // Enhanced password hashing with higher salt rounds
        const salt = await bcryptjs.genSalt(12)
        const hashPassword = await bcryptjs.hash(password, salt)

        const payload = {
            name: sanitizedName,
            email: sanitizedEmail,
            password : hashPassword
        }

        const newUser = new UserModel(payload)
        const save = await newUser.save()

        // Send verification email using EmailService
        try {
            const emailResult = await EmailService.sendVerificationEmail(sanitizedEmail, sanitizedName, save._id);
            if (!emailResult.success) {
                // Log error for debugging (remove in production)
                // console.error('Email verification failed:', emailResult.error);
            }
        } catch (emailError) {
            // Log error for debugging (remove in production)
            // console.error('Email verification error:', emailError);
            // Continue with registration even if email fails
        }

        return response.status(201).json({
            message : "Registration successful. Please check your email for verification.",
            error : false,
            success : true
        })

    } catch (error) {
        return response.status(500).json({
            message : "Registration failed. Please try again.",
            error : true,
            success : false
        })
    }
}

export async function verifyEmailController(request,response){
    try {
        const { code } = request.body

        if(!code){
            return response.status(400).json({
                message : "Verification code is required",
                error : true,
                success : false
            })
        }

        const user = await UserModel.findById(code)

        if(!user){
            return response.status(400).json({
                message : "Invalid verification code",
                error : true,
                success : false
            })
        }

        if(user.verify_email){
            return response.status(400).json({
                message : "Email already verified",
                error : true,
                success : false
            })
        }

        const updateUser = await UserModel.findByIdAndUpdate(code,{
            verify_email : true
        })

        // Send welcome email after successful verification
        try {
            const welcomeEmailResult = await EmailService.sendWelcomeEmail(updateUser.email, updateUser.name);
            if (!welcomeEmailResult.success) {
                // Log error for debugging (remove in production)
                // console.error('Welcome email failed:', welcomeEmailResult.error);
            }
        } catch (welcomeEmailError) {
            // Log error for debugging (remove in production)
            // console.error('Welcome email error:', welcomeEmailError);
            // Continue even if welcome email fails
        }

        return response.json({
            message : "Email verified successfully",
            error : false,
            success : true
        })

    } catch (error) {
        return response.status(500).json({
            message : "Email verification failed",
            error : true,
            success : false
        })
    }
}

//login controller
export async function loginController(request,response){
    try {
        const { email , password } = request.body

        // Sanitize email
        const sanitizedEmail = email.toLowerCase().trim()

        if(!sanitizedEmail || !password){
            return response.status(400).json({
                message : "Provide email & password",
                error : true,
                success : false
            })
        }

        const user = await UserModel.findOne({ email: sanitizedEmail })

        if(!user){
            return response.status(400).json({
                message : "Invalid email or password",
                error : true,
                success : false
            })
        }

        if(user.status !== "ACTIVE"){
            return response.status(400).json({
                message : "Account is suspended or inactive",
                error : true,
                success : false
            })
        }

        const checkPassword = await bcryptjs.compare(password, user.password)

        if(!checkPassword){
            return response.status(400).json({
                message : "Invalid email or password",
                error : true,
                success : false
            })
        }

        // Check if 2FA is enabled for this user
        if (requiresTwoFactor(user)) {
            // Generate a temporary token for 2FA verification
            const tempToken = await generatedAccessToken(user._id, '5m') // 5 minute expiry
            
            return response.json({
                message : "2FA verification required",
                error : false,
                success : true,
                requires2FA : true,
                data : {
                    tempToken,
                    userId: user._id,
                    email: user.email
                }
            })
        }

        // If no 2FA, proceed with normal login
        const accesstoken = await generatedAccessToken(user._id)
        const refreshToken = await genertedRefreshToken(user._id)

        // Update last login
        await UserModel.findByIdAndUpdate(user?._id,{
            last_login_date : new Date()
        })

        const cookiesOption = {
            httpOnly : true,
            secure : process.env.NODE_ENV === 'production',
            sameSite : "strict",
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        }
        
        response.cookie('accessToken', accesstoken, cookiesOption)
        response.cookie('refreshToken', refreshToken, cookiesOption)

        return response.json({
            message : "Login successful",
            error : false,
            success : true,
            requires2FA : false,
            data : {
                accesstoken,
                refreshToken,
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    twoFactorEnabled: user.twoFactorEnabled,
                    twoFactorVerified: user.twoFactorVerified,
                    twoFactorBackupCodes: user.twoFactorBackupCodes
                }
            }
        })

    } catch (error) {
        return response.status(500).json({
            message : "Login failed. Please try again.",
            error : true,
            success : false
        })
    }
}

//logout controller
export async function logoutController(request,response){
    try {
        const userid = request.userId //middleware

        const cookiesOption = {
            httpOnly : true,
            secure : true,
            sameSite : "None"
        }

        response.clearCookie("accessToken",cookiesOption)
        response.clearCookie("refreshToken",cookiesOption)

        const removeRefreshToken = await UserModel.findByIdAndUpdate(userid,{
            refresh_token : ""
        })

        return response.json({
            message : "Logout successfully",
            error : false,
            success : true
        })
    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

//upload user avatar
export async  function uploadAvatar(request,response){
    try {
        const userId = request.userId // auth middlware
        const image = request.file  // multer middleware

        const upload = await uploadImageCloudinary(image)
        
        const updateUser = await UserModel.findByIdAndUpdate(userId,{
            avatar : upload.url
        })

        return response.json({
            message : "uploaded profile",
            success : true,
            error : false,
            data : {
                _id : userId,
                avatar : upload.url
            }
        })

    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

//update user details
export async function updateUserDetails(request,response){
    try {
        const userId = request.userId //auth middleware
        const { name, email, mobile, password } = request.body 

        let hashPassword = ""

        if(password){
            const salt = await bcryptjs.genSalt(10)
            hashPassword = await bcryptjs.hash(password,salt)
        }

        const updateUser = await UserModel.updateOne({ _id : userId},{
            ...(name && { name : name }),
            ...(email && { email : email }),
            ...(mobile && { mobile : mobile }),
            ...(password && { password : hashPassword })
        })

        return response.json({
            message : "Updated successfully",
            error : false,
            success : true,
            data : updateUser
        })

    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

//forgot password not login
export async function forgotPasswordController(request,response) {
    try {
        const { email } = request.body 

        const user = await UserModel.findOne({ email })

        if(!user){
            return response.status(400).json({
                message : "Email not available",
                error : true,
                success : false
            })
        }

        const otp = generatedOtp()
        const expireTime = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now

        const update = await UserModel.findByIdAndUpdate(user._id,{
            forgot_password_otp : otp, // OTP is already a string
            forgot_password_expiry : expireTime.toISOString()
        })

        const emailResult = await EmailService.sendPasswordResetEmail(email, user.name, otp);
        if (!emailResult.success) {
            // Log error for debugging (remove in production)
            // console.error('Password reset email failed:', emailResult.error);
        }

        return response.json({
            message : "Otp sent to your email",
            error : false,
            success : true
        })

    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

//verify forgot password otp
export async function verifyForgotPasswordOtp(request,response){
    try {
        const { email , otp }  = request.body

        if(!email || !otp){
            return response.status(400).json({
                message : "Provide required field email, otp.",
                error : true,
                success : false
            })
        }

        const user = await UserModel.findOne({ email })

        if(!user){
            return response.status(400).json({
                message : "Email not available",
                error : true,
                success : false
            })
        }

        const currentTime = new Date().toISOString()

        if(user.forgot_password_expiry < currentTime  ){
            return response.status(400).json({
                message : "Otp is expired",
                error : true,
                success : false
            })
        }

        if(otp !== user.forgot_password_otp){
            return response.status(400).json({
                message : "Invalid otp",
                error : true,
                success : false
            })
        }

        //if otp is not expired
        //otp === user.forgot_password_otp

        const updateUser = await UserModel.findByIdAndUpdate(user?._id,{
            forgot_password_otp : "",
            forgot_password_expiry : ""
        })
        
        return response.json({
            message : "Verify otp successfully",
            error : false,
            success : true
        })

    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

//reset the password
export async function resetpassword(request,response){
    try {
        const { email , newPassword, confirmPassword } = request.body 

        if(!email || !newPassword || !confirmPassword){
            return response.status(400).json({
                message : "provide required fields email, newPassword, confirmPassword"
            })
        }

        const user = await UserModel.findOne({ email })

        if(!user){
            return response.status(400).json({
                message : "Email is not available",
                error : true,
                success : false
            })
        }

        if(newPassword !== confirmPassword){
            return response.status(400).json({
                message : "newPassword and confirmPassword must be same.",
                error : true,
                success : false,
            })
        }

        const salt = await bcryptjs.genSalt(10)
        const hashPassword = await bcryptjs.hash(newPassword,salt)

        const update = await UserModel.findOneAndUpdate(user._id,{
            password : hashPassword
        })

        return response.json({
            message : "Password updated successfully.",
            error : false,
            success : true
        })

    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

//refresh token controler
export async function refreshToken(request,response){
    try {
        const refreshToken = request.cookies.refreshToken || request?.headers?.authorization?.split(" ")[1]  /// [ Bearer token]

        if(!refreshToken){
            return response.status(401).json({
                message : "Unauthorised access",
                error  : true,
                success : false
            })
        }

        const verifyToken = await jwt.verify(refreshToken,process.env.SECRET_KEY_REFRESH_TOKEN)

        if(!verifyToken){
            return response.status(401).json({
                message : "token is expired",
                error : true,
                success : false
            })
        }

        const userId = verifyToken?._id

        const newAccessToken = await generatedAccessToken(userId)

        const cookiesOption = {
            httpOnly : true,
            secure : true,
            sameSite : "None"
        }

        response.cookie('accessToken',newAccessToken,cookiesOption)

        return response.json({
            message : "New Access token generated",
            error : false,
            success : true,
            data : {
                accessToken : newAccessToken
            }
        })

    } catch (error) {
        return response.status(500).json({
            message : error.message || error,
            error : true,
            success : false
        })
    }
}

//get login user details
export async function userDetails(request,response){
    try {
        const userId  = request.userId

        const user = await UserModel.findById(userId).select('-password -refresh_token')

        return response.json({
            message : 'user details',
            data : user,
            error : false,
            success : true
        })
    } catch (error) {
        return response.status(500).json({
            message : "Something is wrong",
            error : true,
            success : false
        })
    }
}

// 2FA Setup - Generate secret and QR code
export const setupTwoFactor = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await UserModel.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Generate new 2FA secret
    const twoFactorData = await generateTwoFactorSecret(user.email);
    const backupCodes = generateBackupCodes();

    // Update user with 2FA data (but don't enable yet)
    // Use findByIdAndUpdate to ensure all fields are properly set
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      {
        twoFactorSecret: twoFactorData.secret,
        twoFactorBackupCodes: backupCodes,
        twoFactorVerified: false,
        twoFactorEnabled: false // Ensure it's not enabled until verified
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: "Failed to update user with 2FA data"
      });
    }

    res.status(200).json({
      success: true,
      message: "2FA setup initiated",
      data: {
        secret: twoFactorData.secret,
        qrCode: twoFactorData.qrCode,
        backupCodes: backupCodes
      }
    });
  } catch (error) {
    // Log error for debugging (remove in production)
    // console.error('2FA Setup Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to setup 2FA: " + error.message
    });
  }
};

// 2FA Verification - Verify token and enable 2FA
export const verifyTwoFactor = async (req, res) => {
  try {
    const { token, backupCode } = req.body;
    const userId = req.userId;
    const user = await UserModel.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (!user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: "2FA not set up. Please setup 2FA first."
      });
    }

    let isValid = false;
    let updatedBackupCodes = user.twoFactorBackupCodes || [];

    // Check if user provided a backup code
    if (backupCode) {
      if (!isValidBackupCode(backupCode)) {
        return res.status(400).json({
          success: false,
          message: "Invalid backup code format"
        });
      }

      const backupResult = verifyBackupCodeUtil(backupCode, user.twoFactorBackupCodes || []);
      if (backupResult.success) {
        isValid = true;
        updatedBackupCodes = backupResult.updatedCodes;
      }
    } else {
      // Verify TOTP token
      if (!isValidToken(token)) {
        return res.status(400).json({
          success: false,
          message: "Invalid token format. Please enter a 6-digit code."
        });
      }

      isValid = verifyTwoFactorToken(token, user.twoFactorSecret);
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code"
      });
    }

    // Enable 2FA using findByIdAndUpdate
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      {
        twoFactorEnabled: true,
        twoFactorVerified: true,
        twoFactorBackupCodes: updatedBackupCodes
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: "Failed to enable 2FA"
      });
    }

    res.status(200).json({
      success: true,
      message: "2FA enabled successfully",
      data: {
        twoFactorEnabled: updatedUser.twoFactorEnabled,
        twoFactorVerified: updatedUser.twoFactorVerified,
        twoFactorBackupCodes: updatedUser.twoFactorBackupCodes
      }
    });
  } catch (error) {
    // Log error for debugging (remove in production)
    // console.error('2FA Verification Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to verify 2FA: " + error.message
    });
  }
};

// Disable 2FA
export const disableTwoFactor = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await UserModel.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Clear 2FA data using findByIdAndUpdate
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
        twoFactorVerified: false
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: "Failed to disable 2FA"
      });
    }

    res.status(200).json({
      success: true,
      message: "2FA disabled successfully",
      data: {
        twoFactorEnabled: updatedUser.twoFactorEnabled,
        twoFactorVerified: updatedUser.twoFactorVerified,
        twoFactorBackupCodes: updatedUser.twoFactorBackupCodes
      }
    });
  } catch (error) {
    // Log error for debugging (remove in production)
    // console.error('2FA Disable Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to disable 2FA: " + error.message
    });
  }
};

// Verify backup code during login
export const verifyBackupCode = async (req, res) => {
  try {
    const { backupCode, userId } = req.body;
    
    if (!backupCode || !userId) {
      return res.status(400).json({
        success: false,
        message: "Backup code and user ID are required"
      });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        message: "2FA not enabled for this user"
      });
    }

    if (!isValidBackupCode(backupCode)) {
      return res.status(400).json({
        success: false,
        message: "Invalid backup code format"
      });
    }

    const backupResult = verifyBackupCodeUtil(backupCode, user.twoFactorBackupCodes || []);
    if (!backupResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid backup code"
      });
    }

    // Update user with remaining backup codes using findByIdAndUpdate
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      {
        twoFactorBackupCodes: backupResult.updatedCodes
      },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: "Failed to update backup codes"
      });
    }

    res.status(200).json({
      success: true,
      message: "Backup code verified successfully"
    });
  } catch (error) {
    // Log error for debugging (remove in production)
    // console.error('Backup Code Verification Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to verify backup code: " + error.message
    });
  }
};

// 2FA Login Verification - Complete login after 2FA verification
export const verify2FALogin = async (req, res) => {
  try {
    const { token, backupCode, userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (!requiresTwoFactor(user)) {
      return res.status(400).json({
        success: false,
        message: "2FA not enabled for this user"
      });
    }

    let isValid = false;
    let updatedBackupCodes = user.twoFactorBackupCodes || [];

    // Check if user provided a backup code
    if (backupCode) {
      if (!isValidBackupCode(backupCode)) {
        return res.status(400).json({
          success: false,
          message: "Invalid backup code format"
        });
      }

      const backupResult = verifyBackupCodeUtil(backupCode, user.twoFactorBackupCodes || []);
      if (backupResult.success) {
        isValid = true;
        updatedBackupCodes = backupResult.updatedCodes;
      }
    } else {
      // Verify TOTP token
      if (!isValidToken(token)) {
        return res.status(400).json({
          success: false,
          message: "Invalid token format. Please enter a 6-digit code."
        });
      }

      isValid = verifyTwoFactorToken(token, user.twoFactorSecret);
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code"
      });
    }

    // Generate full access tokens
    const accesstoken = await generatedAccessToken(user._id)
    const refreshToken = await genertedRefreshToken(user._id)

    // Update last login and backup codes if used
    await UserModel.findByIdAndUpdate(user._id, {
      last_login_date: new Date(),
      twoFactorBackupCodes: updatedBackupCodes
    })

    const cookiesOption = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000
    }
    
    res.cookie('accessToken', accesstoken, cookiesOption)
    res.cookie('refreshToken', refreshToken, cookiesOption)

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        accesstoken,
        refreshToken,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          twoFactorEnabled: user.twoFactorEnabled,
          twoFactorVerified: user.twoFactorVerified,
          twoFactorBackupCodes: updatedBackupCodes
        }
      }
    });
  } catch (error) {
    // Log error for debugging (remove in production)
    // console.error('2FA Login Verification Error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to verify 2FA login: " + error.message
    });
  }
};