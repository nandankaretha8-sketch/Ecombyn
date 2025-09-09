import SiteSettingsModel from '../models/siteSettings.model.js'

// Get all site settings
export const getSiteSettings = async (request, response) => {
  try {
    // Use raw MongoDB operations to avoid schema conflicts
    const db = SiteSettingsModel.db
    const collection = db.collection('sitesettings')
    
    let settings = await collection.findOne({})
    
    if (!settings) {
      // Create new settings with proper structure
      settings = {
        companyName: 'Axar',
        companyDescription: 'Your trusted destination for quality products. We provide the best shopping experience with fast delivery and excellent customer service.',
        phone: '+91 98765 43210',
        email: 'support@axar.com',
        address: '123 Shopping Street, Mumbai, Maharashtra 400001',
        businessHours: {
          weekdays: 'Monday - Saturday: 9:00 AM - 8:00 PM',
          sunday: 'Sunday: 10:00 AM - 6:00 PM'
        },
        images: {
          logo: '',
          favicon: ''
        },
        socialMedia: {
          facebook: '#',
          instagram: '#',
          twitter: '#',
          linkedin: '#',
          youtube: '#',
          visibility: {
            facebook: true,
            instagram: true,
            twitter: true,
            linkedin: true,
            youtube: true
          }
        },
        privacyPolicy: {
          sections: [{
            heading: 'Introduction',
            content: 'Privacy Policy content will be displayed here...'
          }]
        },
        refundPolicy: {
          sections: [{
            heading: 'Introduction',
            content: 'Refund Policy content will be displayed here...'
          }]
        },
        orderSettings: {
          codLimit: 1000,
          codEnabled: true,
          freeShippingThreshold: 500
        },
        productSettings: {
          showOutOfStockProducts: false
        },
        promotionalBanner: {
          isEnabled: false,
          text: '',
          backgroundColor: 'bg-pink-500',
          textColor: 'text-white'
        },
        contactUs: {
          title: 'Contact Us',
          description: 'Get in touch with us for any questions or support.',
          content: 'Contact Us page content will be displayed here...'
        },
        storeLocation: {
          title: 'Store Location',
          description: 'Visit our store to explore our collection of traditional art and crafts in person.',
          content: 'Store Location page content will be displayed here...',
          address: '123 Art Street, Near City Center\nRajkot, Gujarat 360001\nIndia',
          phone: '+91 98765 43210',
          email: 'store@aksharart.com',
          businessHours: {
            weekdays: 'Monday - Saturday: 9:00 AM - 8:00 PM',
            sunday: 'Sunday: 10:00 AM - 6:00 PM'
          },
          gettingHere: {
            byCar: 'Located on Art Street, just 2 minutes from City Center. Ample parking available.',
            byPublicTransport: 'Bus routes 101, 102, and 103 stop within walking distance. Nearest bus stop: City Center.',
            byAutoRickshaw: 'Tell the driver "Akshar Art, Art Street" - they will know the location.',
            googleMapsLink: 'https://maps.google.com'
          },
          storeFeatures: [
            'Wide selection of traditional art and crafts',
            'Expert staff to help with selection',
            'Customization services available',
            'Gift wrapping service',
            'Air-conditioned showroom',
            'Wheelchair accessible'
          ],
          locations: [{
            name: 'Main Store',
            address: '123 Shopping Street, Mumbai, Maharashtra 400001',
            phone: '+91 98765 43210',
            email: 'store@axar.com',
            hours: 'Monday - Saturday: 9:00 AM - 8:00 PM'
          }]
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      await collection.insertOne(settings)
    } else {
      // Handle migration of existing data
      let needsUpdate = false
      
      if (settings.privacyPolicy && typeof settings.privacyPolicy === 'string') {
        settings.privacyPolicy = {
          sections: [{
            heading: 'Privacy Policy',
            content: settings.privacyPolicy
          }]
        }
        needsUpdate = true
      }
      
      if (settings.refundPolicy && typeof settings.refundPolicy === 'string') {
        settings.refundPolicy = {
          sections: [{
            heading: 'Refund Policy',
            content: settings.refundPolicy
          }]
        }
        needsUpdate = true
      }
      
      // Ensure policy sections exist
      if (!settings.privacyPolicy || !settings.privacyPolicy.sections) {
        settings.privacyPolicy = {
          sections: [{
            heading: 'Introduction',
            content: 'Privacy Policy content will be displayed here...'
          }]
        }
        needsUpdate = true
      }
      
      if (!settings.refundPolicy || !settings.refundPolicy.sections) {
        settings.refundPolicy = {
          sections: [{
            heading: 'Introduction',
            content: 'Refund Policy content will be displayed here...'
          }]
        }
        needsUpdate = true
      }
      
      // Update if needed
      if (needsUpdate) {
        settings.updatedAt = new Date()
        await collection.updateOne(
          { _id: settings._id },
          { $set: settings }
        )
      }
    }
    
    return response.status(200).json({
      message: "Site settings retrieved successfully",
      success: true,
      data: settings
    })
  } catch (error) {
    // Log error for debugging (remove in production)
    // console.error('Error retrieving site settings:', error)
    return response.status(500).json({
      message: "Error retrieving site settings",
      success: false,
      error: error.message
    })
  }
}

// Get COD settings only (public endpoint)
export const getCODSettings = async (request, response) => {
  try {
    const settings = await SiteSettingsModel.getSettings()
    
    return response.status(200).json({
      message: "COD settings retrieved successfully",
      success: true,
      data: {
        codEnabled: settings.orderSettings?.codEnabled || false,
        codLimit: settings.orderSettings?.codLimit || 0
      }
    })
  } catch (error) {
    return response.status(500).json({
      message: "Error retrieving COD settings",
      success: false,
      error: error.message
    })
  }
}

// Get product settings only (public endpoint)
export const getProductSettings = async (request, response) => {
  try {
    const settings = await SiteSettingsModel.getSettings()
    
    return response.status(200).json({
      message: "Product settings retrieved successfully",
      success: true,
      data: {
        showOutOfStockProducts: settings.productSettings?.showOutOfStockProducts || false
      }
    })
  } catch (error) {
    return response.status(500).json({
      message: "Error retrieving product settings",
      success: false,
      error: error.message
    })
  }
}

// Update site settings
export const updateSiteSettings = async (request, response) => {
  try {
    const updateData = request.body
    
    if (!updateData) {
      return response.status(400).json({
        message: "No data provided for update",
        success: false
      })
    }
    
    // Use raw MongoDB operations to avoid schema conflicts
    const db = SiteSettingsModel.db
    const collection = db.collection('sitesettings')
    
    let settings = await collection.findOne({})
    if (!settings) {
      // Remove _id from updateData before creating new document
      const { _id, ...dataToInsert } = updateData
      settings = await collection.insertOne(dataToInsert)
    }
    
    // Handle migration of old policy format to new format
    if (updateData.privacyPolicy && typeof updateData.privacyPolicy === 'string') {
      updateData.privacyPolicy = {
        sections: [{
          heading: 'Privacy Policy',
          content: updateData.privacyPolicy
        }]
      }
    }
    
    if (updateData.refundPolicy && typeof updateData.refundPolicy === 'string') {
      updateData.refundPolicy = {
        sections: [{
          heading: 'Refund Policy',
          content: updateData.refundPolicy
        }]
      }
    }
    
    // Ensure policy sections exist
    if (updateData.privacyPolicy && !updateData.privacyPolicy.sections) {
      updateData.privacyPolicy.sections = []
    }
    
    if (updateData.refundPolicy && !updateData.refundPolicy.sections) {
      updateData.refundPolicy.sections = []
    }
    
    // Validate sections structure
    if (updateData.privacyPolicy && updateData.privacyPolicy.sections) {
      updateData.privacyPolicy.sections = updateData.privacyPolicy.sections.map(section => ({
        heading: section.heading || 'Section',
        content: section.content || ''
      }))
    }
    
    if (updateData.refundPolicy && updateData.refundPolicy.sections) {
      updateData.refundPolicy.sections = updateData.refundPolicy.sections.map(section => ({
        heading: section.heading || 'Section',
        content: section.content || ''
      }))
    }
    
    // Remove _id field from updateData to prevent MongoDB immutable field error
    const { _id, ...dataToUpdate } = updateData
    
    // Add timestamp
    dataToUpdate.updatedAt = new Date()
    
    // Update the document
    const result = await collection.findOneAndUpdate(
      { _id: settings._id },
      { $set: dataToUpdate },
      { returnDocument: 'after' }
    )
    
    return response.status(200).json({
      message: "Site settings updated successfully",
      success: true,
      data: result.value
    })
  } catch (error) {
    // Log error for debugging (remove in production)
    // console.error('Error updating site settings:', error)
    return response.status(500).json({
      message: "Error updating site settings",
      success: false,
      error: error.message
    })
  }
}

// Update specific section (e.g., contact info, social media, etc.)
export const updateSection = async (request, response) => {
  try {
    const { section, data } = request.body
    
    if (!section || !data) {
      return response.status(400).json({
        message: "Section and data are required",
        success: false
      })
    }
    
    let settings = await SiteSettingsModel.findOne()
    if (!settings) {
      settings = new SiteSettingsModel()
    }
    
    // Update the specific section
    if (settings[section]) {
      if (typeof data === 'object') {
        Object.keys(data).forEach(key => {
          if (data[key] !== undefined) {
            settings[section][key] = data[key]
          }
        })
      } else {
        settings[section] = data
      }
    } else {
      return response.status(400).json({
        message: "Invalid section",
        success: false
      })
    }
    
    await settings.save()
    
    return response.status(200).json({
      message: `${section} updated successfully`,
      success: true,
      data: settings[section]
    })
  } catch (error) {
    return response.status(500).json({
      message: "Error updating section",
      success: false,
      error: error.message
    })
  }
}
