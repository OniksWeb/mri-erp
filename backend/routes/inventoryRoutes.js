// backend/routes/inventoryRoutes.js
import express from 'express';
import { getInventory, createItem, deleteItem, recordTransaction } from '../controllers/inventoryController.js';
import { auth as protect, authorizeRoles } from '../src/middleware/auth.js';

const router = express.Router();

// ✅ Allow inventory_admin, inventory_manager, and admin to manage inbound inventory / consumables
router.get('/', protect, authorizeRoles('admin', 'inventory_manager', 'inventory_admin'), getInventory);
router.post('/', protect, authorizeRoles('admin', 'inventory_manager', 'inventory_admin'), createItem);
router.delete('/:id', protect, authorizeRoles('admin', 'inventory_manager', 'inventory_admin'), deleteItem);
router.post('/transaction', protect, authorizeRoles('admin', 'inventory_manager', 'inventory_admin'), recordTransaction);

export default router;