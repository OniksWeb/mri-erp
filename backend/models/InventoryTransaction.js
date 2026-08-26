// backend/models/InventoryTransaction.js
const mongoose = require('mongoose');

const InventoryTransactionSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
  type: { type: String, enum: ['IN', 'OUT_LAB', 'OUT_CUSTOMER'], required: true },
  quantity: { type: Number, required: true },
  recipientType: { type: String, enum: ['INTERNAL_LAB', 'CUSTOMER'], required: true },
  recipientName: { type: String, required: true },
  contactInfo: { type: String },
  scheduledDate: { type: Date },
  status: { type: String, enum: ['PENDING', 'COMPLETED'], default: 'PENDING' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('InventoryTransaction', InventoryTransactionSchema);