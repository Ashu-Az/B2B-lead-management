// models/ServiceQRCode.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ServiceQRCodeSchema = new mongoose.Schema({
  uniqueId: {
    type: String,
    unique: true,
    default: function() {
      return uuidv4(); // Generate a unique UUID by default
    }
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  frontendUrl: {
    type: String,
    required: true,
    trim: true
  },
  services: [{
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true
    },
    displayOrder: {
      type: Number,
      default: 0
    }
  }],
  qrCodeImage: {
    type: String,
    required: true
  },
  scans: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastScannedAt: {
    type: Date
  }
});

module.exports = mongoose.model('ServiceQRCode', ServiceQRCodeSchema);