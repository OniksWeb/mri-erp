// backend/routes/inventoryRoutes.js
const express = require('express');
const router = express.Router();
const { getInventory, createItem, deleteItem, recordTransaction } = require('../controllers/inventoryController');
const { protect, adminOnly } = require('../middleware/authMiddleware'); // assuming standard auth guards

router.get('/', protect, getInventory);
router.post('/', protect, createItem);
router.delete('/:id', protect, adminOnly, deleteItem);
router.post('/transaction', protect, recordTransaction);

module.exports = router;