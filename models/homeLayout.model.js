import mongoose from 'mongoose'

const homeLayoutSchema = new mongoose.Schema({
  // Layout configuration for home page components
  components: [{
    id: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          const staticIds = ['header', 'banner', 'category_icons', 'ugc_videos', 'footer']
          return staticIds.includes(v) || /^category_products_\d+$/.test(v) || /^between_category_banner_\d+$/.test(v)
        },
        message: 'Invalid component id'
      }
    },
    name: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    isEnabled: {
      type: Boolean,
      default: true
    },
    order: {
      type: Number,
      required: true
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: false // Only required for category_products components
    },
    categoryName: {
      type: String,
      required: false // Only required for category_products components
    },
    displayName: {
      type: String,
      required: false // Custom display name for the component
    },
    bannerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Banner',
      required: false // Only required for between_category_banner components
    },
    categoryPosition: {
      type: Number,
      required: false // Only required for between_category_banner components
    }
  }],
  
  // Global settings
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Version control
  version: {
    type: Number,
    default: 1
  },
  
  // Metadata
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Allow null for default layouts
  },
  
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Allow null for default layouts
  }
}, {
  timestamps: true
})

// Ensure only one active layout configuration exists
homeLayoutSchema.statics.getActiveLayout = async function() {
  let layout = await this.findOne({ isActive: true }).sort({ version: -1 })
  if (!layout) {
    // Create default layout if none exists
    layout = await this.createDefaultLayout()
  }
  return layout
}

// Create default layout configuration
homeLayoutSchema.statics.createDefaultLayout = async function() {
  const defaultComponents = [
    {
      id: 'header',
      name: 'Header',
      description: 'Main navigation header',
      isEnabled: true,
      order: 1
    },
    {
      id: 'banner',
      name: 'Banner Carousel',
      description: 'Main promotional banner section',
      isEnabled: true,
      order: 2
    },
    {
      id: 'category_icons',
      name: 'Category Icons',
      description: 'Category navigation icons',
      isEnabled: true,
      order: 3
    },
    {
      id: 'category_products_1',
      name: 'First Category Products',
      description: 'Products from first category',
      isEnabled: true,
      order: 4
    },
    {
      id: 'ugc_videos',
      name: 'UGC Videos',
      description: 'User generated content videos',
      isEnabled: true,
      order: 5
    },
    {
      id: 'category_products_2',
      name: 'Second Category Products',
      description: 'Products from second category',
      isEnabled: true,
      order: 6
    },
    {
      id: 'category_products_3',
      name: 'Third Category Products',
      description: 'Products from third category',
      isEnabled: true,
      order: 7
    },
    {
      id: 'category_products_4',
      name: 'Fourth Category Products',
      description: 'Products from fourth category',
      isEnabled: true,
      order: 8
    },
    {
      id: 'category_products_5',
      name: 'Fifth Category Products',
      description: 'Products from fifth category',
      isEnabled: true,
      order: 9
    },
    {
      id: 'footer',
      name: 'Footer',
      description: 'Main footer section',
      isEnabled: true,
      order: 10
    }
  ]

  try {
    return await this.create({
      components: defaultComponents,
      isActive: true,
      version: 1,
      createdBy: null, // Will be set when admin creates/modifies
      lastModifiedBy: null
    })
  } catch (error) {
    console.error('Error creating default layout:', error)
    throw error
  }
}

// Validate component order uniqueness
homeLayoutSchema.pre('save', function(next) {
  const orders = this.components.map(c => c.order)
  const uniqueOrders = [...new Set(orders)]
  
  if (orders.length !== uniqueOrders.length) {
    return next(new Error('Component orders must be unique'))
  }
  
  next()
})

const HomeLayoutModel = mongoose.model('HomeLayout', homeLayoutSchema)

export default HomeLayoutModel
