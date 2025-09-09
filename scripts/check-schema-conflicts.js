import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Import all models to check for conflicts
import '../models/user.model.js';
import '../models/product.model.js';
import '../models/category.model.js';
import '../models/subCategory.model.js';
import '../models/orderV2.model.js';
import '../models/cartproduct.model.js';
import '../models/coupon.model.js';

import '../models/siteSettings.model.js';
import '../models/wishlist.model.js';
import '../models/address.model.js';
import '../models/banner.model.js';
import '../models/supportTicket.model.js';
import '../models/visitor.model.js';
import '../models/inventory.model.js';

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/akshar_art_db";

async function checkSchemaConflicts() {
    try {
        console.log("🔍 Checking for MongoDB schema conflicts...");
        
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log("✅ Connected to MongoDB");
        
        // Get all registered models
        const modelNames = Object.keys(mongoose.models);
        console.log(`📋 Found ${modelNames.length} registered models:`, modelNames);
        
        // Check for duplicate collection names
        const collectionNames = new Set();
        const duplicates = [];
        
        for (const modelName of modelNames) {
            const model = mongoose.models[modelName];
            const collectionName = model.collection.name;
            
            if (collectionNames.has(collectionName)) {
                duplicates.push({
                    modelName,
                    collectionName
                });
            } else {
                collectionNames.add(collectionName);
            }
        }
        
        if (duplicates.length > 0) {
            console.log("❌ Found duplicate collection names:");
            duplicates.forEach(dup => {
                console.log(`   - Model: ${dup.modelName}, Collection: ${dup.collectionName}`);
            });
        } else {
            console.log("✅ No duplicate collection names found");
        }
        
        // Check for duplicate indexes
        console.log("\n🔍 Checking for duplicate indexes...");
        
        for (const modelName of modelNames) {
            const model = mongoose.models[modelName];
            const collectionName = model.collection.name;
            
            try {
                const indexes = await model.collection.indexes();
                console.log(`📊 ${modelName} (${collectionName}): ${indexes.length} indexes`);
                
                // Check for duplicate index definitions
                const indexKeys = new Set();
                const duplicateIndexes = [];
                
                indexes.forEach(index => {
                    const keyStr = JSON.stringify(index.key);
                    if (indexKeys.has(keyStr)) {
                        duplicateIndexes.push(keyStr);
                    } else {
                        indexKeys.add(keyStr);
                    }
                });
                
                if (duplicateIndexes.length > 0) {
                    console.log(`   ❌ Duplicate indexes in ${modelName}:`, duplicateIndexes);
                }
                
            } catch (error) {
                console.log(`   ⚠️  Could not check indexes for ${modelName}:`, error.message);
            }
        }
        
        console.log("\n✅ Schema conflict check completed!");
        
    } catch (error) {
        console.error("❌ Error checking schema conflicts:", error.message);
    } finally {
        await mongoose.disconnect();
        console.log("🔌 Disconnected from MongoDB");
    }
}

// Run the check
checkSchemaConflicts();
