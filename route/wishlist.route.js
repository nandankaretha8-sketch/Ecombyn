import { Router } from "express";
import auth from "../middleware/auth.js";
import { 
    addToWishlistController, 
    getWishlistController, 
    removeFromWishlistController,
    checkWishlistController 
} from "../controllers/wishlist.controller.js";

const wishlistRouter = Router()

wishlistRouter.post('/add', auth, addToWishlistController)
wishlistRouter.get("/get", auth, getWishlistController)
wishlistRouter.delete('/remove', auth, removeFromWishlistController)
wishlistRouter.get('/check/:productId', auth, checkWishlistController)

export default wishlistRouter
