import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
    name : {
        type : String,
        default : ""
    },
    image : {
        type : String,
        default : ""
    },
    order : {
        type : Number,
        default : 0
    }
},{
    timestamps : true
})

// Index for efficient querying by order
categorySchema.index({ order: 1 })

const CategoryModel = mongoose.model('Category',categorySchema)

export default CategoryModel