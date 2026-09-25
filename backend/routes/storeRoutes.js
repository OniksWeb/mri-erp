// backend/routes/storeRoutes.js
import express from 'express';
import { 
    getStoreItems, 
    addStoreItem, 
    updateStoreItem,
    deleteStoreItem,
    checkoutStoreItem, 
    returnStoreItem, 
    getStoreLogs 
} from '../controllers/storeController.js';
import { auth as protect, authorizeRoles } from '../src/middleware/auth.js';

const router = express.Router();

router.get('/items', protect, authorizeRoles('admin', 'inventory_manager'), getStoreItems);
router.post('/items', protect, authorizeRoles('admin', 'inventory_manager'), addStoreItem);
router.put('/items/:id', protect, authorizeRoles('admin', 'inventory_manager'), updateStoreItem);
router.delete('/items/:id', protect, authorizeRoles('admin', 'inventory_manager'), deleteStoreItem);

router.post('/checkout', protect, authorizeRoles('admin', 'inventory_manager'), checkoutStoreItem);
router.post('/return', protect, authorizeRoles('admin', 'inventory_manager'), returnStoreItem);
router.get('/logs', protect, authorizeRoles('admin', 'inventory_manager'), getStoreLogs);

export default router;