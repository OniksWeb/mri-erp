// backend/routes/inventoryRoutes.js
import express from 'express';
import {
    getInventoryItems,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    adjustInventoryStock,
    getInventoryMovements
} from '../controllers/inventoryController.js';
import { auth as protect, authorizeRoles } from '../src/middleware/auth.js';

const router = express.Router();

router.get('/items', protect, authorizeRoles('admin', 'inventory_manager'), getInventoryItems);
router.post('/items', protect, authorizeRoles('admin', 'inventory_manager'), addInventoryItem);
router.put('/items/:id', protect, authorizeRoles('admin', 'inventory_manager'), updateInventoryItem);
router.delete('/items/:id', protect, authorizeRoles('admin', 'inventory_manager'), deleteInventoryItem);

router.post('/adjust', protect, authorizeRoles('admin', 'inventory_manager'), adjustInventoryStock);
router.get('/movements', protect, authorizeRoles('admin', 'inventory_manager'), getInventoryMovements);

export default router;