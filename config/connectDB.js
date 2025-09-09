import mongoose from "mongoose";
import dotenv from 'dotenv'
dotenv.config()

// Use fallback MongoDB URI if not provided in environment
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/akshar_art_db"

// Cache the connection to avoid multiple connections in serverless
let cached = global.mongoose

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null }
}

async function connectDB() {
    // If already connected, return the existing connection
    if (cached.conn) {
        console.log("Using existing MongoDB connection")
        return cached.conn
    }

    // If connection is in progress, wait for it
    if (cached.promise) {
        console.log("Waiting for existing MongoDB connection...")
        return await cached.promise
    }

    // Create new connection
    console.log("Creating new MongoDB connection...")
    
    const options = {
        maxPoolSize: 10, // Maintain up to 10 socket connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        family: 4, // Use IPv4, skip trying IPv6
        retryWrites: true,
        w: 'majority',
        // Serverless optimizations
        bufferCommands: false, // Disable mongoose buffering
    };

    cached.promise = mongoose.connect(MONGODB_URI, options).then((mongoose) => {
        console.log("MongoDB connected successfully")
        
        // Handle connection events (only set once)
        if (!mongoose.connection.listeners('error').length) {
            mongoose.connection.on('error', (err) => {
                console.error('MongoDB connection error:', err);
                // Clear cache on error to allow retry
                cached.conn = null
                cached.promise = null
            });
            
            mongoose.connection.on('disconnected', () => {
                console.log('MongoDB disconnected');
                // Clear cache on disconnect
                cached.conn = null
                cached.promise = null
            });
            
            mongoose.connection.on('reconnected', () => {
                console.log('MongoDB reconnected');
            });
        }
        
        return mongoose
    }).catch((error) => {
        console.error("MongoDB connection error:", error.message)
        console.log("Please check your MONGODB_URI in .env file")
        console.log("Make sure the URI is correct and includes username, password, and database name")
        
        // Clear cache on error
        cached.conn = null
        cached.promise = null
        
        // In serverless, don't exit process - just throw error
        throw error
    })

    try {
        cached.conn = await cached.promise
    } catch (e) {
        cached.promise = null
        throw e
    }

    return cached.conn
}

export default connectDB