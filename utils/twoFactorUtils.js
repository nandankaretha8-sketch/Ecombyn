import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import crypto from 'crypto';

/**
 * Generate a new 2FA secret for a user
 * @param {string} userEmail - User's email for QR code label
 * @returns {Object} Secret and QR code data
 */
export const generateTwoFactorSecret = async (userEmail) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `AksharArt (${userEmail})`,
      issuer: 'AksharArt',
      length: 32
    });

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);
    
    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
      otpauthUrl: secret.otpauth_url
    };
  } catch (error) {
    // Log error for debugging (remove in production)
    // console.error('Error generating 2FA secret:', error);
    throw new Error('Failed to generate 2FA secret');
  }
};

/**
 * Verify a 2FA token
 * @param {string} token - The 6-digit token from authenticator app
 * @param {string} secret - The user's 2FA secret
 * @returns {boolean} Whether the token is valid
 */
export const verifyTwoFactorToken = (token, secret) => {
  try {
    if (!token || !secret) {
      return false;
    }

    // Verify the token with a 30-second window (current, previous, next)
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 1 // Allow 30 seconds before/after
    });
  } catch (error) {
    // Log error for debugging (remove in production)
    // console.error('Error verifying 2FA token:', error);
    return false;
  }
};

/**
 * Generate backup codes for 2FA
 * @returns {Array} Array of 8 backup codes
 */
export const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 8; i++) {
    // Generate 8-character alphanumeric codes
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
};

/**
 * Verify a backup code
 * @param {string} backupCode - The backup code to verify
 * @param {Array} userBackupCodes - User's stored backup codes
 * @returns {Object} Result with success status and updated backup codes
 */
export const verifyBackupCode = (backupCode, userBackupCodes) => {
  try {
    if (!backupCode || !userBackupCodes || !Array.isArray(userBackupCodes)) {
      return { success: false, updatedCodes: userBackupCodes };
    }

    const normalizedCode = backupCode.toUpperCase().replace(/\s/g, '');
    const codeIndex = userBackupCodes.findIndex(code => 
      code.toUpperCase().replace(/\s/g, '') === normalizedCode
    );

    if (codeIndex === -1) {
      return { success: false, updatedCodes: userBackupCodes };
    }

    // Remove the used backup code
    const updatedCodes = userBackupCodes.filter((_, index) => index !== codeIndex);
    
    return { success: true, updatedCodes };
  } catch (error) {
    // Log error for debugging (remove in production)
    // console.error('Error verifying backup code:', error);
    return { success: false, updatedCodes: userBackupCodes };
  }
};

/**
 * Check if user requires 2FA verification
 * @param {Object} user - User object from database
 * @returns {boolean} Whether 2FA verification is required
 */
export const requiresTwoFactor = (user) => {
  return user && user.twoFactorEnabled && user.twoFactorSecret;
};

/**
 * Validate if a token format is correct
 * @param {string} token - The token to validate
 * @returns {boolean} Whether the token format is valid
 */
export const isValidToken = (token) => {
  return token && /^\d{6}$/.test(token);
};

/**
 * Validate if a backup code format is correct
 * @param {string} backupCode - The backup code to validate
 * @returns {boolean} Whether the backup code format is valid
 */
export const isValidBackupCode = (backupCode) => {
  return backupCode && /^[A-F0-9]{8}$/i.test(backupCode.replace(/\s/g, ''));
};
