// backend/models/Coupon.js - Updated with additional fields
const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
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
  couponCode: {
    type: String,
    required: true
  },
  dealValue: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['generated', 'verified', 'claimed', 'used', 'expired'],
    default: 'generated'
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isGlobal: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('Coupon', CouponSchema);