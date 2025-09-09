import mongoose from 'mongoose'

const bannerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  image: {
    type: String,
    required: true
  },
  mobileImage: {
    type: String,
    default: ''
  },
  link: {
    type: String,
    default: ''
  },
  order: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  },
  // New field for banner type
  type: {
    type: String,
    enum: ['main', 'between_categories'],
    default: 'main'
  },
  // New field for category position (only for between_categories type)
  categoryPosition: {
    type: Number,
    default: 0 // 0 means after first category, 1 means after second category, etc.
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

// Index for efficient querying
bannerSchema.index({ active: 1, order: 1 })
bannerSchema.index({ type: 1, active: 1, categoryPosition: 1 })

const BannerModel = mongoose.model('Banner', bannerSchema)

export default BannerModel
