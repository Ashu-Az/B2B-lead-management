// backend/models/Purchase.js
const mongoose = require('mongoose');

const PurchaseSchema = new mongoose.Schema({
  claim: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Claim',
    required: true
  },
  originalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  discountPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  discountAmount: {
    type: Number,
    required: true,
    min: 0
  },
  finalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  commissionPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  commissionAmount: {
    type: Number,
    required: true,
    min: 0
  },
  purchasedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Purchase', PurchaseSchema);

