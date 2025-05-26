const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AffiliateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true
  },
  upiId: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    default: 'affiliate'
  },
  permissions: {
    viewOwnQRCodes: { type: Boolean, default: true },
    viewOwnStats: { type: Boolean, default: true },
    manageProfile: { type: Boolean, default: true }
  },
  commissionRate: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'rejected', 'suspended'],
    default: 'inactive'
  },
  statusNotes: {
    type: String,
    trim: true
  },
  statusUpdatedAt: {
    type: Date
  },
  statusUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  couponStatus: {
    type: String,
    enum: ['active', 'inactive', 'expired'],
    default: 'inactive'
  },
  startDate: { type: Date },
  expiryDate: { type: Date },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
AffiliateSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

AffiliateSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Affiliate', AffiliateSchema);