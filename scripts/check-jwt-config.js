#!/usr/bin/env node

import dotenv from 'dotenv'
import crypto from 'crypto'

// Load environment variables
dotenv.config()

// Check JWT configuration
const checkJWTConfig = () => {
    console.log('🔐 JWT Configuration Check\n')
    
    const accessTokenSecret = process.env.SECRET_KEY_ACCESS_TOKEN
    const refreshTokenSecret = process.env.SECRET_KEY_REFRESH_TOKEN
    
    console.log('📋 Environment Variables Status:')
    console.log('================================')
    
    // Check if secrets exist
    const hasAccessToken = !!accessTokenSecret
    const hasRefreshToken = !!refreshTokenSecret
    
    console.log(`Access Token Secret: ${hasAccessToken ? '✅ Present' : '❌ Missing'}`)
    console.log(`Refresh Token Secret: ${hasRefreshToken ? '✅ Present' : '❌ Missing'}`)
    
    if (hasAccessToken) {
        const accessLength = accessTokenSecret.length
        console.log(`Access Token Length: ${accessLength} characters`)
        console.log(`Access Token Strength: ${accessLength >= 32 ? '✅ Strong' : '⚠️ Weak (should be 32+ characters)'}`)
    }
    
    if (hasRefreshToken) {
        const refreshLength = refreshTokenSecret.length
        console.log(`Refresh Token Length: ${refreshLength} characters`)
        console.log(`Refresh Token Strength: ${refreshLength >= 32 ? '✅ Strong' : '⚠️ Weak (should be 32+ characters)'}`)
    }
    
    // Check if secrets are different
    if (hasAccessToken && hasRefreshToken) {
        const areDifferent = accessTokenSecret !== refreshTokenSecret
        console.log(`Secrets are different: ${areDifferent ? '✅ Yes' : '❌ No (should be different)'}`)
    }
    
    // Check other required environment variables
    console.log('\n📋 Other Required Variables:')
    console.log('============================')
    
    const requiredVars = [
        'MONGODB_URI',
        'FRONTEND_URL',
        'NODE_ENV'
    ]
    
    requiredVars.forEach(varName => {
        const value = process.env[varName]
        const status = value ? '✅ Present' : '❌ Missing'
        console.log(`${varName}: ${status}`)
    })
    
    // Overall assessment
    console.log('\n📊 Overall JWT Security Assessment:')
    console.log('===================================')
    
    const hasBothSecrets = hasAccessToken && hasRefreshToken
    const accessStrong = hasAccessToken && accessTokenSecret.length >= 32
    const refreshStrong = hasRefreshToken && refreshTokenSecret.length >= 32
    const areDifferent = hasBothSecrets && accessTokenSecret !== refreshTokenSecret
    
    if (hasBothSecrets && accessStrong && refreshStrong && areDifferent) {
        console.log('✅ JWT Configuration is SECURE')
        console.log('✅ All secrets are properly configured')
        console.log('✅ Secrets are strong and unique')
    } else if (hasBothSecrets) {
        console.log('⚠️ JWT Configuration needs improvement')
        if (!accessStrong) console.log('❌ Access token secret is too weak')
        if (!refreshStrong) console.log('❌ Refresh token secret is too weak')
        if (!areDifferent) console.log('❌ Access and refresh tokens are the same')
    } else {
        console.log('❌ JWT Configuration is INSECURE')
        console.log('❌ Missing required JWT secrets')
    }
    
    // Generate recommendations
    console.log('\n🔧 Recommendations:')
    console.log('==================')
    
    if (!hasAccessToken || !hasRefreshToken) {
        console.log('1. Generate strong JWT secrets:')
        console.log('   Access Token: ' + crypto.randomBytes(32).toString('hex'))
        console.log('   Refresh Token: ' + crypto.randomBytes(32).toString('hex'))
    }
    
    if (hasAccessToken && accessTokenSecret.length < 32) {
        console.log('2. Access token secret should be at least 32 characters')
    }
    
    if (hasRefreshToken && refreshTokenSecret.length < 32) {
        console.log('3. Refresh token secret should be at least 32 characters')
    }
    
    if (hasBothSecrets && accessTokenSecret === refreshTokenSecret) {
        console.log('4. Access and refresh tokens should be different')
    }
    
    console.log('\n✅ JWT configuration check completed!')
}

// Run the check
checkJWTConfig()
