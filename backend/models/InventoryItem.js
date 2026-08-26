// backend/models/InventoryItem.js
const mongoose = require('mongoose');

const InventoryItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, required: true, default: 0 },
  unitPrice: { type: Number, required: true, default: 0 },
  minStockLevel: { type: Number, required: true, default: 5 },
}, { timestamps: true });

module.exports = mongoose.model('InventoryItem', InventoryItemSchema);