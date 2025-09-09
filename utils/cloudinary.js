import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLODINARY_CLOUD_NAME,
    api_key: process.env.CLODINARY_API_KEY,
    api_secret: process.env.CLODINARY_API_SECRET_KEY
});

export const uploadImageCloudinary = async (image, folder = 'reviews') => {
    try {
        // Handle base64 image data
        if (typeof image === 'string' && image.startsWith('data:image')) {
            const uploadResult = await cloudinary.uploader.upload(image, {
                folder: folder,
                resource_type: 'image'
            });
            return uploadResult;
        }
        
        // Handle buffer/image file
        const buffer = image?.buffer || Buffer.from(await image.arrayBuffer());
        
        const uploadResult = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { folder: folder },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            ).end(buffer);
        });
        
        return uploadResult;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw new Error('Failed to upload image to Cloudinary');
    }
};

export default {
    uploadImageCloudinary
};
