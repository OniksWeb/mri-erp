// backend/routes/inventoryRoutes.js
const express = require('express');
const router = express.Router();
const { getInventory, createItem, deleteItem, recordTransaction } = require('../controllers/inventoryController');
const { auth: protect, authorizeRoles: adminOnly } = require('../src/middleware/auth');

router.get('/', protect, getInventory);
router.post('/', protect, createItem);
router.delete('/:id', protect, adminOnly, deleteItem);
router.post('/transaction', protect, recordTransaction);

export default router;