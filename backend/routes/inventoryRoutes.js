// backend/routes/inventoryRoutes.js
import express from 'express';
import { getInventory, createItem, deleteItem, recordTransaction } from '../controllers/inventoryController.js';
import { auth as protect, authorizeRoles as adminOnly } from '../src/middleware/auth.js';

const router = express.Router();

router.get('/', protect, getInventory);
router.post('/', protect, createItem);
router.delete('/:id', deleteItem);
router.post('/transaction', protect, recordTransaction);

export default router;