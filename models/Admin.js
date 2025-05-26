const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const AdminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'superadmin'],
    default: 'admin'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  // Other fields...
  permissions: {
    viewOwnQRCodes: { type: Boolean, default: true },
    viewOwnStats: { type: Boolean, default: true },
    manageProfile: { type: Boolean, default: true }
  },
  permissions: {
    createAffiliate: { type: Boolean, default: true },
    manageQRCodes: { type: Boolean, default: true },
    manageCustomers: { type: Boolean, default: true },
    viewReports: { type: Boolean, default: true }
  },
  couponStatus: {
    type: String,
    enum: ['active', 'inactive'],
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
AdminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

AdminSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Admin', AdminSchema);