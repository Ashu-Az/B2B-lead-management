const mongoose = require('mongoose');

const QRCodeSchema = new mongoose.Schema({
  affiliate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: true
  },
  discountPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  commissionPercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  qrCodeData: {
    type: String,
    required: true
  },
  qrCodeImage: {
    type: String,
    required: true
  },
  redirectUrl: {
    type: String,
    default: '' 
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

module.exports = mongoose.model('QRCode', QRCodeSchema);