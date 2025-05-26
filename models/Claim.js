// backend/models/Claim.js
const mongoose = require('mongoose');

const ClaimSchema = new mongoose.Schema({
  qrCode: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'QRCode',
    required: true
  },
  customerName: {
    type: String,
    required: true,
    trim: true
  },
  customerPhone: {
    type: String,
    required: true,
    trim: true
  },
  claimedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['claimed', 'purchased', 'expired'],
    default: 'claimed'
  }
});

module.exports = mongoose.model('Claim', ClaimSchema);

