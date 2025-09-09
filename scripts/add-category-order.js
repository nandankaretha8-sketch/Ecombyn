import mongoose from 'mongoose'
import CategoryModel from '../models/category.model.js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const migrateCategoryOrder = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to MongoDB')

    // Get all categories
    const categories = await CategoryModel.find({})
    console.log(`Found ${categories.length} categories`)

    // Update each category with proper order field
    let updatedCount = 0
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i]
      
      // Update order field for all categories
      await CategoryModel.findByIdAndUpdate(category._id, {
        order: i
      })
      updatedCount++
      console.log(`Updated category: ${category.name} with order: ${i}`)
    }

    console.log(`Migration completed. Updated ${updatedCount} categories.`)
    
    // Verify the migration
    const updatedCategories = await CategoryModel.find({}).sort({ order: 1 })
    console.log('\nCategories in order:')
    updatedCategories.forEach((cat, index) => {
      console.log(`${index + 1}. ${cat.name} (order: ${cat.order})`)
    })

  } catch (error) {
    console.error('Migration failed:', error)
  } finally {
    await mongoose.disconnect()
    console.log('Disconnected from MongoDB')
  }
}

// Run migration
migrateCategoryOrder()
