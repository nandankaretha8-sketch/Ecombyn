import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import '../models/inventory.model.js';

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/akshar_art_db";

async function fixInventoryIndexes() {
    try {
        console.log("🔧 Fixing inventory indexes...");
        
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log("✅ Connected to MongoDB");
        
        const InventoryModel = mongoose.models.inventory;
        
        // Drop all existing indexes except _id
        console.log("🗑️  Dropping existing indexes...");
        await InventoryModel.collection.dropIndexes();
        console.log("✅ Dropped existing indexes");
        
        // Recreate the indexes properly
        console.log("🔨 Recreating indexes...");
        
        await InventoryModel.collection.createIndex({ product: 1 });
        // Note: sku index is already defined in the schema, so we don't need to create it here
        await InventoryModel.collection.createIndex({ barcode: 1 });
        await InventoryModel.collection.createIndex({ currentStock: 1 });
        await InventoryModel.collection.createIndex({ availableStock: 1 });
        await InventoryModel.collection.createIndex({ isActive: 1 });
        await InventoryModel.collection.createIndex({ expiryDate: 1 });
        await InventoryModel.collection.createIndex({ "stockMovements.createdAt": -1 });
        
        console.log("✅ Indexes recreated successfully");
        
        // Verify the indexes
        const indexes = await InventoryModel.collection.indexes();
        console.log(`📊 Total indexes: ${indexes.length}`);
        indexes.forEach((index, i) => {
            console.log(`   ${i + 1}. ${JSON.stringify(index.key)} - ${index.unique ? 'unique' : 'non-unique'}`);
        });
        
    } catch (error) {
        console.error("❌ Error fixing inventory indexes:", error.message);
    } finally {
        await mongoose.disconnect();
        console.log("🔌 Disconnected from MongoDB");
    }
}

// Run the fix
fixInventoryIndexes();
