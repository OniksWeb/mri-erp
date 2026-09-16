// backend/routes/storeRoutes.js
import express from 'express';
import { 
    getStoreItems, 
    addStoreItem, 
    checkoutStoreItem, 
    returnStoreItem, 
    getStoreLogs,
    deleteStoreItem // 👈 1. Import the delete controller
} from '../controllers/storeController.js';
import { auth as protect, authorizeRoles } from '../src/middleware/auth.js';

const router = express.Router();

router.get('/items', protect, authorizeRoles('admin', 'inventory_manager'), getStoreItems);
router.post('/items', protect, authorizeRoles('admin', 'inventory_manager'), addStoreItem);
router.delete('/items/:id', protect, authorizeRoles('admin', 'inventory_manager'), deleteStoreItem); // 👈 2. Add the DELETE route
router.post('/checkout', protect, authorizeRoles('admin', 'inventory_manager'), checkoutStoreItem);
router.post('/return', protect, authorizeRoles('admin', 'inventory_manager'), returnStoreItem);
router.get('/logs', protect, authorizeRoles('admin', 'inventory_manager'), getStoreLogs);

export default router;