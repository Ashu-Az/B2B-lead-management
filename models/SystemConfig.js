// In models/SystemConfig.js
const mongoose = require('mongoose');

const SystemConfigSchema = new mongoose.Schema({
  defaultDiscountPercentage: {
    type: Number,
    default: 10,
    min: 0,
    max: 100
  },
  defaultCommissionPercentage: {
    type: Number,
    default: 5,
    min: 0,
    max: 100
  },
  globalDiscountPercentage: {
    type: Number,
    default: 5,
    min: 0,
    max: 100
  },
  globalDiscountMessage: {
    type: String,
    default: 'Hurry up! Get special discount on your visit!'
  },
  couponExpiryHours: {
    type: Number,
    default: 24,
    min: 1
  },
  frontendBaseUrl: {
    type: String,
    default: 'https://elevate-coupon-landing-page.vercel.app'
  },
  whatsappEnabled: {
    type: Boolean,
    default: false
  },
  whatsappApiKey: {
    type: String,
    default: ''
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Static method to get configuration
SystemConfigSchema.statics.getConfig = async function() {
  const config = await this.findOne();
  if (config) {
    return config;
  }
  
  // Create default config if none exists
  return await this.create({});
};

module.exports = mongoose.model('SystemConfig', SystemConfigSchema);