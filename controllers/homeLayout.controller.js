import HomeLayoutModel from '../models/homeLayout.model.js'
import CategoryModel from '../models/category.model.js'

// Get active home page layout
export const getActiveHomeLayout = async (request, response) => {
  try {
    const layout = await HomeLayoutModel.getActiveLayout()
    
    response.status(200).json({
      success: true,
      data: layout,
      message: 'Home layout retrieved successfully'
    })
  } catch (error) {
    console.error('Error getting home layout:', error)
    response.status(500).json({
      success: false,
      message: 'Failed to retrieve home layout',
      error: error.message
    })
  }
}

// Get all home page layouts (for admin)
export const getAllHomeLayouts = async (request, response) => {
  try {
    const layouts = await HomeLayoutModel.find()
      .sort({ version: -1, createdAt: -1 })
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email')
    
    response.status(200).json({
      success: true,
      data: layouts,
      message: 'All home layouts retrieved successfully'
    })
  } catch (error) {
    console.error('Error getting all home layouts:', error)
    response.status(500).json({
      success: false,
      message: 'Failed to retrieve home layouts',
      error: error.message
    })
  }
}

// Create new home page layout
export const createHomeLayout = async (request, response) => {
  try {
    const { components, isActive } = request.body
    const userId = request.user?._id || request.userId || null

    // Validate components
    if (!components || !Array.isArray(components) || components.length === 0) {
      return response.status(400).json({
        success: false,
        message: 'Components array is required and must not be empty'
      })
    }

    // Validate component structure
    for (const component of components) {
      if (!component.id || !component.name || !component.description || component.order === undefined) {
        return response.status(400).json({
          success: false,
          message: 'Each component must have id, name, description, and order'
        })
      }
    }

    // If this will be the active layout, deactivate others
    if (isActive) {
      await HomeLayoutModel.updateMany(
        { isActive: true },
        { isActive: false }
      )
    }

    // Get the next version number
    const lastLayout = await HomeLayoutModel.findOne().sort({ version: -1 })
    const nextVersion = lastLayout ? lastLayout.version + 1 : 1

    // Create new layout
    const newLayout = new HomeLayoutModel({
      components,
      isActive,
      version: nextVersion,
      createdBy: userId,
      lastModifiedBy: userId
    })

    await newLayout.save()

    response.status(201).json({
      success: true,
      data: newLayout,
      message: 'Home layout created successfully'
    })
  } catch (error) {
    console.error('Error creating home layout:', error)
    response.status(500).json({
      success: false,
      message: 'Failed to create home layout',
      error: error.message
    })
  }
}

// Update existing home page layout
export const updateHomeLayout = async (request, response) => {
  try {
    const { layoutId } = request.params
    const { components, isActive } = request.body
    const userId = request.user?._id || request.userId || null

    const layout = await HomeLayoutModel.findById(layoutId)
    if (!layout) {
      return response.status(404).json({
        success: false,
        message: 'Home layout not found'
      })
    }

    // Validate components if provided
    if (components) {
      if (!Array.isArray(components) || components.length === 0) {
        return response.status(400).json({
          success: false,
          message: 'Components must be a non-empty array'
        })
      }

      // Validate component structure
      for (const component of components) {
        if (!component.id || !component.name || !component.description || component.order === undefined) {
          return response.status(400).json({
            success: false,
            message: 'Each component must have id, name, description, and order'
          })
        }
      }
    }

    // If this will be the active layout, deactivate others
    if (isActive) {
      await HomeLayoutModel.updateMany(
        { _id: { $ne: layoutId }, isActive: true },
        { isActive: false }
      )
    }

    // Update layout
    const updatedLayout = await HomeLayoutModel.findByIdAndUpdate(
      layoutId,
      {
        ...(components && { components }),
        ...(isActive !== undefined && { isActive }),
        lastModifiedBy: userId
      },
      { new: true, runValidators: true }
    )

    response.status(200).json({
      success: true,
      data: updatedLayout,
      message: 'Home layout updated successfully'
    })
  } catch (error) {
    console.error('Error updating home layout:', error)
    response.status(500).json({
      success: false,
      message: 'Failed to update home layout',
      error: error.message
    })
  }
}

// Delete home page layout
export const deleteHomeLayout = async (request, response) => {
  try {
    const { layoutId } = request.params

    const layout = await HomeLayoutModel.findById(layoutId)
    if (!layout) {
      return response.status(404).json({
        success: false,
        message: 'Home layout not found'
      })
    }

    // Don't allow deletion of active layout
    if (layout.isActive) {
      return response.status(400).json({
        success: false,
        message: 'Cannot delete active layout. Please activate another layout first.'
      })
    }

    await HomeLayoutModel.findByIdAndDelete(layoutId)

    response.status(200).json({
      success: true,
      message: 'Home layout deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting home layout:', error)
    response.status(500).json({
      success: false,
      message: 'Failed to delete home layout',
      error: error.message
    })
  }
}

// Activate a specific layout
export const activateHomeLayout = async (request, response) => {
  try {
    const { layoutId } = request.params

    const layout = await HomeLayoutModel.findById(layoutId)
    if (!layout) {
      return response.status(404).json({
        success: false,
        message: 'Home layout not found'
      })
    }

    // Deactivate all other layouts
    await HomeLayoutModel.updateMany(
      { _id: { $ne: layoutId } },
      { isActive: false }
    )

    // Activate the selected layout
    layout.isActive = true
    layout.lastModifiedBy = request.user?._id || request.userId || null
    await layout.save()

    response.status(200).json({
      success: true,
      data: layout,
      message: 'Home layout activated successfully'
    })
  } catch (error) {
    console.error('Error activating home layout:', error)
    response.status(500).json({
      success: false,
      message: 'Failed to activate home layout',
      error: error.message
    })
  }
}

// Get available categories for component assignment
export const getAvailableCategories = async (request, response) => {
  try {
    const categories = await CategoryModel.find({ isActive: true })
      .select('_id name image order')
      .sort({ order: 1, name: 1 })

    response.status(200).json({
      success: true,
      data: categories,
      message: 'Available categories retrieved successfully'
    })
  } catch (error) {
    console.error('Error getting available categories:', error)
    response.status(500).json({
      success: false,
      message: 'Failed to retrieve available categories',
      error: error.message
    })
  }
}

// Duplicate existing layout
export const duplicateHomeLayout = async (request, response) => {
  try {
    const { layoutId } = request.params
    const userId = request.user?._id || request.userId || null

    const originalLayout = await HomeLayoutModel.findById(layoutId)
    if (!originalLayout) {
      return response.status(404).json({
        success: false,
        message: 'Original home layout not found'
      })
    }

    // Get the next version number
    const lastLayout = await HomeLayoutModel.findOne().sort({ version: -1 })
    const nextVersion = lastLayout ? lastLayout.version + 1 : 1

    // Create duplicate with new version
    const duplicatedLayout = new HomeLayoutModel({
      components: originalLayout.components,
      isActive: false, // Duplicate is not active by default
      version: nextVersion,
      createdBy: userId,
      lastModifiedBy: userId
    })

    await duplicatedLayout.save()

    response.status(201).json({
      success: true,
      data: duplicatedLayout,
      message: 'Home layout duplicated successfully'
    })
  } catch (error) {
    console.error('Error duplicating home layout:', error)
    response.status(500).json({
      success: false,
      message: 'Failed to duplicate home layout',
      error: error.message
    })
  }
}
