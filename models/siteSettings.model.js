import mongoose from 'mongoose'

const siteSettingsSchema = new mongoose.Schema({
  // Company Information
  companyName: {
    type: String,
    default: 'Axar'
  },
  siteName: {
    type: String,
    default: 'Axar'
  },
  companyDescription: {
    type: String,
    default: 'Your trusted destination for quality products. We provide the best shopping experience with fast delivery and excellent customer service.'
  },
  
  // Contact Information
  phone: {
    type: String,
    default: '+91 98765 43210'
  },
  email: {
    type: String,
    default: 'support@axar.com'
  },
  address: {
    type: String,
    default: '123 Shopping Street, Mumbai, Maharashtra 400001'
  },
  
  // Business Hours
  businessHours: {
    weekdays: {
      type: String,
      default: 'Monday - Saturday: 9:00 AM - 8:00 PM'
    },
    sunday: {
      type: String,
      default: 'Sunday: 10:00 AM - 6:00 PM'
    }
  },
  
  // Website Images
  images: {
    logo: {
      type: String,
      default: ''
    },
    favicon: {
      type: String,
      default: ''
    }
  },
  
  // Social Media Links
  socialMedia: {
    facebook: {
      type: String,
      default: '#'
    },
    instagram: {
      type: String,
      default: '#'
    },
    twitter: {
      type: String,
      default: '#'
    },
    linkedin: {
      type: String,
      default: '#'
    },
    youtube: {
      type: String,
      default: '#'
    },
    visibility: {
      facebook: {
        type: Boolean,
        default: true
      },
      instagram: {
        type: Boolean,
        default: true
      },
      twitter: {
        type: Boolean,
        default: true
      },
      linkedin: {
        type: Boolean,
        default: true
      },
      youtube: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // Policy Content
  privacyPolicy: {
    sections: [{
      heading: {
        type: String,
        default: 'Introduction'
      },
      content: {
        type: String,
        default: 'Privacy Policy content will be displayed here...'
      }
    }]
  },
  refundPolicy: {
    sections: [{
      heading: {
        type: String,
        default: 'Introduction'
      },
      content: {
        type: String,
        default: 'Refund Policy content will be displayed here...'
      }
    }]
  },
  
  // Order Settings
  orderSettings: {
    codLimit: {
      type: Number,
      default: 1000, // Default COD limit of ₹1000
      min: 0,
      max: 100000
    },
    codEnabled: {
      type: Boolean,
      default: true
    },
    freeShippingThreshold: {
      type: Number,
      default: 500, // Default free shipping threshold of ₹500
      min: 0,
      max: 100000
    }
  },
  
  // Product Settings
  productSettings: {
    showOutOfStockProducts: {
      type: Boolean,
      default: false // Default: hide out-of-stock products from users
    },
    lowStockThreshold: {
      type: Number,
      default: 3, // Default low stock threshold
      min: 1,
      max: 100
    }
  },

  // Review System Settings
  reviewSettings: {
    isEnabled: {
      type: Boolean,
      default: true // Default: reviews are enabled
    },
    allowGuestReviews: {
      type: Boolean,
      default: false // Default: only logged-in users can review
    },
    requirePurchase: {
      type: Boolean,
      default: true // Default: only customers who purchased can review
    },
    autoApprove: {
      type: Boolean,
      default: false // Default: reviews require admin approval
    },
    maxImagesPerReview: {
      type: Number,
      default: 3,
      min: 0,
      max: 10
    },
    maxReviewLength: {
      type: Number,
      default: 1000,
      min: 100,
      max: 5000
    }
  },
  
  // Store Location Page Content
  storeLocation: {
    title: {
      type: String,
      default: 'Store Location'
    },
    description: {
      type: String,
      default: 'Visit our store to explore our collection of traditional art and crafts in person.'
    },
    content: {
      type: String,
      default: 'Store Location page content will be displayed here...'
    },
    address: {
      type: String,
      default: '123 Art Street, Near City Center\nRajkot, Gujarat 360001\nIndia'
    },
    phone: {
      type: String,
      default: '+91 98765 43210'
    },
    email: {
      type: String,
      default: 'store@aksharart.com'
    },
    businessHours: {
      weekdays: {
        type: String,
        default: 'Monday - Saturday: 9:00 AM - 8:00 PM'
      },
      sunday: {
        type: String,
        default: 'Sunday: 10:00 AM - 6:00 PM'
      },
      holidays: {
        type: String,
        default: 'Closed on major holidays'
      }
    },
    storePhotos: {
      storeFront: {
        type: String,
        default: ''
      },
      interior: {
        type: String,
        default: ''
      },
      products: {
        type: String,
        default: ''
      },
      workshop: {
        type: String,
        default: ''
      }
    },
    locations: [{
      name: {
        type: String,
        default: 'Main Store'
      },
      address: {
        type: String,
        default: '123 Shopping Street, Mumbai, Maharashtra 400001'
      },
      phone: {
        type: String,
        default: '+91 98765 43210'
      },
      email: {
        type: String,
        default: 'store@axar.com'
      },
      hours: {
        type: String,
        default: 'Monday - Saturday: 9:00 AM - 8:00 PM'
      }
    }]
  },

  // Promotional Banner Settings
  promotionalBanner: {
    isEnabled: {
      type: Boolean,
      default: false
    },
    text: {
      type: String,
      default: ''
    },
    backgroundColor: {
      type: String,
      default: 'bg-pink-500'
    },
    textColor: {
      type: String,
      default: 'text-white'
    },
    customBackgroundColor: {
      type: String,
      default: ''
    },
    customTextColor: {
      type: String,
      default: ''
    },
    useCustomBackgroundColor: {
      type: Boolean,
      default: false
    },
    useCustomTextColor: {
      type: Boolean,
      default: false
    },
    textAnimation: {
      type: String,
      default: 'none',
      enum: ['none', 'pulse', 'bounce', 'fade', 'slide', 'marquee', 'typewriter', 'glow', 'shake', 'wiggle']
    },
    animationSpeed: {
      type: String,
      default: 'normal',
      enum: ['slow', 'normal', 'fast']
    }
  }
}, {
  timestamps: true
})

// Ensure only one settings document exists
siteSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne()
  if (!settings) {
    settings = await this.create({})
  }
  return settings
}

const SiteSettingsModel = mongoose.model('SiteSettings', siteSettingsSchema)

export default SiteSettingsModel
