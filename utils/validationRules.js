// backend/utils/validationRules.js
const { check } = require('express-validator');

exports.adminLoginRules = [
  check('username', 'Username is required').not().isEmpty(),
  check('password', 'Password is required').not().isEmpty()
];

exports.adminRegisterRules = [
  check('username', 'Username is required').not().isEmpty(),
  check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  check('email', 'Please include a valid email').isEmail(),
  check('name', 'Name is required').not().isEmpty()
];

exports.affiliateRules = [
  check('name', 'Name is required').not().isEmpty(),
  check('phoneNumber', 'Phone number is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('address', 'Address is required').not().isEmpty()
];

exports.qrCodeRules = [
  check('affiliateId', 'Affiliate ID is required').not().isEmpty(),
  check('discountPercentage', 'Discount percentage must be between 0 and 100').isFloat({ min: 0, max: 100 }),
  check('commissionPercentage', 'Commission percentage must be between 0 and 100').isFloat({ min: 0, max: 100 })
];

exports.claimRules = [
  check('qrCodeId', 'QR Code ID is required').not().isEmpty(),
  check('customerName', 'Customer name is required').not().isEmpty(),
  check('customerPhone', 'Customer phone is required').not().isEmpty()
];

exports.purchaseRules = [
  check('claimId', 'Claim ID is required').not().isEmpty(),
  check('originalAmount', 'Original amount must be a positive number').isFloat({ min: 0 })
];



