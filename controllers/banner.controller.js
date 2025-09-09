import BannerModel from '../models/banner.model.js'

// Get all banners (admin)
export const getAllBanners = async (request, response) => {
  try {
    const banners = await BannerModel.find({})
      .sort({ order: 1, createdAt: -1 })
      .select('-__v')

    response.status(200).json({
      success: true,
      message: 'Banners fetched successfully',
      data: banners
    })
  } catch (error) {
    response.status(500).json({
      success: false,
      message: 'Error fetching banners',
      error: error.message
    })
  }
}

// Get active banners for frontend (public)
export const getActiveBanners = async (request, response) => {
  try {
    const banners = await BannerModel.find({ active: true, type: 'main' })
      .sort({ order: 1, createdAt: -1 })
      .select('title description image mobileImage link')
      .limit(20) // Limit for performance

    response.status(200).json({
      success: true,
      message: 'Active banners fetched successfully',
      data: banners
    })
  } catch (error) {
    response.status(500).json({
      success: false,
      message: 'Error fetching active banners',
      error: error.message
    })
  }
}

// Get between-category banners for frontend (public)
export const getBetweenCategoryBanners = async (request, response) => {
  try {
    const banners = await BannerModel.find({ 
      active: true, 
      type: 'between_categories' 
    })
      .sort({ categoryPosition: 1, order: 1, createdAt: -1 })
      .select('title description image mobileImage link categoryPosition')
      .limit(50) // Limit for performance

    response.status(200).json({
      success: true,
      message: 'Between-category banners fetched successfully',
      data: banners
    })
  } catch (error) {
    response.status(500).json({
      success: false,
      message: 'Error fetching between-category banners',
      error: error.message
    })
  }
}

// Create new banner
export const createBanner = async (request, response) => {
  try {
    const { title, description, image, mobileImage, link, order, active, type, categoryPosition } = request.body

    // Validate required fields
    if (!title || !image) {
      return response.status(400).json({
        success: false,
        message: 'Title and image are required'
      })
    }

    // Create banner
    const banner = new BannerModel({
      title,
      description: description || '',
      image,
      mobileImage: mobileImage || image,
      link: link || '',
      order: order || 0,
      active: active !== undefined ? active : true,
      type: type || 'main',
      categoryPosition: categoryPosition || 0
    })

    await banner.save()

    response.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: banner
    })
  } catch (error) {
    response.status(500).json({
      success: false,
      message: 'Error creating banner',
      error: error.message
    })
  }
}

// Update banner
export const updateBanner = async (request, response) => {
  try {
    const { id } = request.params
    const { title, description, image, mobileImage, link, order, active, type, categoryPosition } = request.body

    // Validate required fields
    if (!title || !image) {
      return response.status(400).json({
        success: false,
        message: 'Title and image are required'
      })
    }

    // Find and update banner
    const banner = await BannerModel.findByIdAndUpdate(
      id,
      {
        title,
        description: description || '',
        image,
        mobileImage: mobileImage || image,
        link: link || '',
        order: order || 0,
        active: active !== undefined ? active : true,
        type: type || 'main',
        categoryPosition: categoryPosition || 0,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    )

    if (!banner) {
      return response.status(404).json({
        success: false,
        message: 'Banner not found'
      })
    }

    response.status(200).json({
      success: true,
      message: 'Banner updated successfully',
      data: banner
    })
  } catch (error) {
    response.status(500).json({
      success: false,
      message: 'Error updating banner',
      error: error.message
    })
  }
}

// Delete banner
export const deleteBanner = async (request, response) => {
  try {
    const { id } = request.params

    const banner = await BannerModel.findByIdAndDelete(id)

    if (!banner) {
      return response.status(404).json({
        success: false,
        message: 'Banner not found'
      })
    }

    response.status(200).json({
      success: true,
      message: 'Banner deleted successfully'
    })
  } catch (error) {
    response.status(500).json({
      success: false,
      message: 'Error deleting banner',
      error: error.message
    })
  }
}

// Toggle banner active status
export const toggleBannerStatus = async (request, response) => {
  try {
    const { id } = request.params

    const banner = await BannerModel.findById(id)

    if (!banner) {
      return response.status(404).json({
        success: false,
        message: 'Banner not found'
      })
    }

    banner.active = !banner.active
    banner.updatedAt = Date.now()
    await banner.save()

    response.status(200).json({
      success: true,
      message: `Banner ${banner.active ? 'activated' : 'deactivated'} successfully`,
      data: banner
    })
  } catch (error) {
    response.status(500).json({
      success: false,
      message: 'Error toggling banner status',
      error: error.message
    })
  }
}

// Reorder banners
export const reorderBanners = async (request, response) => {
  try {
    const { banners } = request.body

    if (!Array.isArray(banners) || banners.length === 0) {
      return response.status(400).json({
        success: false,
        message: 'Banners array is required'
      })
    }

    // Update each banner's order
    const updatePromises = banners.map(({ id, order }) => 
      BannerModel.findByIdAndUpdate(id, { order, updatedAt: Date.now() })
    )

    await Promise.all(updatePromises)

    response.status(200).json({
      success: true,
      message: 'Banners reordered successfully'
    })
  } catch (error) {
    response.status(500).json({
      success: false,
      message: 'Error reordering banners',
      error: error.message
    })
  }
}

// Get banner by ID
export const getBannerById = async (request, response) => {
  try {
    const { id } = request.params

    const banner = await BannerModel.findById(id).select('-__v')

    if (!banner) {
      return response.status(404).json({
        success: false,
        message: 'Banner not found'
      })
    }

    response.status(200).json({
      success: true,
      message: 'Banner fetched successfully',
      data: banner
    })
  } catch (error) {
    response.status(500).json({
      success: false,
      message: 'Error fetching banner',
      error: error.message
    })
  }
}
