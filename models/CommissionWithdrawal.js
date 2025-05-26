// backend/models/CommissionWithdrawal.js
const mongoose = require('mongoose');

const CommissionWithdrawalSchema = new mongoose.Schema({
  affiliate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  upiId: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'paid'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true
  },
  requestDate: {
    type: Date,
    default: Date.now
  },
  processedDate: {
    type: Date
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  transactionId: {
    type: String,
    trim: true
  },
  paymentScreenshot: {
    type: Object, // For file data
  required: false
  }
});

module.exports = mongoose.model('CommissionWithdrawal', CommissionWithdrawalSchema);