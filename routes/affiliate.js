// backend/routes/affiliate.js - Updated with more routes
const express = require('express');
const router = express.Router();
const affiliateController = require('../controllers/affiliateController');
const affiliateAuthMiddleware = require('../middleware/affiliateAuth');
const { check } = require('express-validator');
const validatorMiddleware = require('../middleware/validator');
const { authenticate, isAffiliate } = require('../middleware/auth');

// Authentication route
router.post('/login', [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists()
], validatorMiddleware.validate, affiliateController.login);

// Public routes
router.get('/:affiliateId', affiliateController.getAffiliateById);

// Protected routes (require authentication)
router.get('/:affiliateId/qrcodes', affiliateAuthMiddleware, affiliateController.getQRCodes);
router.get('/:affiliateId/qrcodes/:qrCodeId', affiliateAuthMiddleware, affiliateController.getQRCodeDetails);
router.get('/:affiliateId/dashboard', affiliateAuthMiddleware, affiliateController.getDashboardData);

// Profile management
router.put('/:affiliateId/profile', [
  authenticate,
  isAffiliate,
  check('name', 'Name is optional').optional(),
  check('phoneNumber', 'Phone number is optional').optional(),
  check('email', 'Please include a valid email if updating').optional().isEmail(),
  check('address', 'Address is optional').optional(),
  check('upiId', 'UPI ID is optional').optional(),
  validatorMiddleware.validate
], affiliateController.updateProfile);

router.get('/test', (req, res) => {
    console.log('Affiliate test route accessed');
    res.json({ message: 'Affiliate routes are working' });
  });

  router.get('/:affiliateId/commission', authenticate, isAffiliate, affiliateController.getCommissionBalance);

router.post('/:affiliateId/withdrawals', [
  authenticate,
  isAffiliate,
  check('amount', 'Amount is required and must be a positive number').isFloat({ min: 0.01 }),
  check('upiId', 'UPI ID is required').notEmpty(),
  validatorMiddleware.validate
], affiliateController.requestWithdrawal);

router.get('/:affiliateId/withdrawals', authenticate, isAffiliate, affiliateController.getWithdrawalHistory);

router.delete('/:affiliateId/withdrawals/:withdrawalId', authenticate, isAffiliate, affiliateController.cancelWithdrawalRequest);

router.put('/:affiliateId/password', [
  affiliateAuthMiddleware,
  check('currentPassword', 'Current password is required').exists(),
  check('newPassword', 'New password must be at least 6 characters').isLength({ min: 6 })
], validatorMiddleware.validate, affiliateController.changePassword);


router.get('/:affiliateId/profile', authenticate, affiliateController.getProfile);

module.exports = router;
