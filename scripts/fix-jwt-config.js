#!/usr/bin/env node

import dotenv from 'dotenv'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config()

// Generate strong JWT secret
const generateStrongSecret = (length = 32) => {
    return crypto.randomBytes(length).toString('hex')
}

// Fix JWT configuration
const fixJWTConfig = () => {
    console.log('🔧 Fixing JWT Configuration\n')
    
    const envPath = path.join(__dirname, '..', '.env')
    const accessTokenSecret = process.env.SECRET_KEY_ACCESS_TOKEN
    const refreshTokenSecret = process.env.SECRET_KEY_REFRESH_TOKEN
    
    console.log('📋 Current Status:')
    console.log('==================')
    console.log(`Access Token Length: ${accessTokenSecret?.length || 0} characters`)
    console.log(`Refresh Token Length: ${refreshTokenSecret?.length || 0} characters`)
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'Missing'}`)
    
    // Read current .env file
    let envContent = ''
    try {
        envContent = fs.readFileSync(envPath, 'utf8')
    } catch (error) {
        console.log('❌ Could not read .env file')
        return
    }
    
    let needsUpdate = false
    let updatedContent = envContent
    
    // Fix access token if it's too weak
    if (!accessTokenSecret || accessTokenSecret.length < 32) {
        console.log('\n🔧 Generating new strong access token secret...')
        const newAccessToken = generateStrongSecret(32)
        
        if (envContent.includes('SECRET_KEY_ACCESS_TOKEN=')) {
            // Replace existing
            updatedContent = updatedContent.replace(
                /SECRET_KEY_ACCESS_TOKEN=.*/,
                `SECRET_KEY_ACCESS_TOKEN=${newAccessToken}`
            )
        } else {
            // Add new
            updatedContent += `\nSECRET_KEY_ACCESS_TOKEN=${newAccessToken}`
        }
        
        console.log('✅ New access token secret generated')
        needsUpdate = true
    }
    
    // Add NODE_ENV if missing
    if (!process.env.NODE_ENV) {
        console.log('\n🔧 Adding NODE_ENV...')
        
        if (envContent.includes('NODE_ENV=')) {
            // Replace existing
            updatedContent = updatedContent.replace(
                /NODE_ENV=.*/,
                'NODE_ENV=development'
            )
        } else {
            // Add new
            updatedContent += '\nNODE_ENV=development'
        }
        
        console.log('✅ NODE_ENV added (set to development)')
        needsUpdate = true
    }
    
    // Write updated .env file
    if (needsUpdate) {
        try {
            fs.writeFileSync(envPath, updatedContent)
            console.log('\n✅ .env file updated successfully!')
            console.log('\n📝 Note: For production, change NODE_ENV=production')
        } catch (error) {
            console.log('❌ Could not write to .env file')
            return
        }
    } else {
        console.log('\n✅ No updates needed - JWT configuration is already secure!')
    }
    
    // Verify the fix
    console.log('\n🔍 Verifying configuration...')
    dotenv.config() // Reload environment variables
    
    const newAccessToken = process.env.SECRET_KEY_ACCESS_TOKEN
    const newRefreshToken = process.env.SECRET_KEY_REFRESH_TOKEN
    const newNodeEnv = process.env.NODE_ENV
    
    console.log(`Access Token Length: ${newAccessToken?.length || 0} characters`)
    console.log(`Refresh Token Length: ${newRefreshToken?.length || 0} characters`)
    console.log(`NODE_ENV: ${newNodeEnv || 'Missing'}`)
    
    // Final assessment
    const isSecure = newAccessToken && newAccessToken.length >= 32 && 
                    newRefreshToken && newRefreshToken.length >= 32 && 
                    newAccessToken !== newRefreshToken && 
                    newNodeEnv
    
    console.log('\n📊 Final Assessment:')
    console.log('====================')
    
    if (isSecure) {
        console.log('✅ JWT Configuration is now SECURE!')
        console.log('✅ All secrets are strong and properly configured')
        console.log('✅ Environment variables are set correctly')
    } else {
        console.log('⚠️ JWT Configuration still needs attention')
    }
    
    console.log('\n🚀 Next steps:')
    console.log('1. Restart your server to load new environment variables')
    console.log('2. Test authentication flows')
    console.log('3. For production: set NODE_ENV=production')
    console.log('4. Run security audit: npm run security-detail')
}

// Run the fix
fixJWTConfig()
