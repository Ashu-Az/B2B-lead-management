// backend/routes/admin.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, isAdmin, isSuperAdmin, hasPermission } = require('../middleware/auth');
const { check } = require('express-validator');
const validatorMiddleware = require('../middleware/validator');
const authController = require('../controllers/authController');

const multer = require('multer');
const path = require('path');

// Configure storage for screenshots
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function(req, file, cb) {
    cb(null, `payment-${Date.now()}${path.extname(file.originalname)}`);
  }
});

// Configure upload options with less restrictive file types
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function(req, file, cb) {
    // Accept images, PDFs, and common document types
    const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype || extname) {
      return cb(null, true);
    }
    cb(null, false);
  }
});

// Auth routes
router.post('/login', [
  check('username', 'Username is required').notEmpty(),
  check('password', 'Password is required').notEmpty(),
  validatorMiddleware.validate
], adminController.login);

router.post('/register', [
  check('username', 'Username is required').notEmpty(),
  check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  check('email', 'Please include a valid email').isEmail(),
  check('name', 'Name is required').notEmpty(),
  validatorMiddleware.validate
], adminController.register);

router.get('/customers', authenticate, isAdmin, adminController.getAllCustomers);

// Protected routes - use authenticate middleware and then check the role/permissions
router.post('/affiliate', [
  authenticate,
  isAdmin,
  check('name', 'Name is required').notEmpty(),
  check('phoneNumber', 'Phone number is required').notEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('address', 'Address is required').notEmpty(),
  validatorMiddleware.validate
], adminController.createAffiliate);

router.get('/affiliates', authenticate, isAdmin, adminController.getAllAffiliates);

router.get('/affiliate/:affiliateId', authenticate, isAdmin, adminController.getAffiliate);

router.put('/affiliate/:affiliateId', [
  authenticate,
  isAdmin,
  check('name', 'Name is required').optional(),
  check('phoneNumber', 'Phone number is required').optional(),
  check('email', 'Please include a valid email').optional().isEmail(),
  check('address', 'Address is required').optional(),
  validatorMiddleware.validate
], adminController.updateAffiliate);

router.delete('/affiliate/:affiliateId', authenticate, isAdmin, adminController.deleteAffiliate);

router.get('/withdrawals', authenticate, isAdmin, adminController.getAllWithdrawals);
router.get('/withdrawals/pending', authenticate, isAdmin, adminController.getPendingWithdrawals);
router.get('/withdrawals/stats', authenticate, isAdmin, adminController.getWithdrawalStats);
router.get('/withdrawals/:withdrawalId', authenticate, isAdmin, adminController.getWithdrawalById);


router.post('/withdrawals/:withdrawalId/process', 
  authenticate, 
  isAdmin,
  upload.single('paymentScreenshot'),
  adminController.processWithdrawal
);

// QR Code operations
router.post('/qrcode', [
  authenticate,
  isAdmin,
  check('affiliateId', 'Affiliate ID is required').notEmpty(),
  check('discountPercentage', 'Discount percentage must be between 0 and 100').isFloat({ min: 0, max: 100 }),
  check('commissionPercentage', 'Commission percentage must be between 0 and 100').isFloat({ min: 0, max: 100 }),
  check('frontendUrl', 'Frontend URL is required').notEmpty(),
  validatorMiddleware.validate
], adminController.generateQRCode);

router.get('/qrcodes', authenticate, isAdmin, adminController.getAllQRCodes);

router.get('/qrcodes/:affiliateId', authenticate, isAdmin, adminController.getAffiliateQRCodes);

router.get('/qrcode/:qrCodeId', authenticate, isAdmin, adminController.getQRCode);

router.patch('/qrcode/:qrCodeId/status', [
  authenticate,
  isAdmin,
  check('isActive', 'isActive field is required').isBoolean(),
  validatorMiddleware.validate
], adminController.updateQRCodeStatus);

router.delete('/qrcode/:qrCodeId', authenticate, isAdmin, adminController.deleteQRCode);

// Purchase processing
router.post('/purchase', [
  authenticate,
  isAdmin,
  check('claimId', 'Claim ID is required').notEmpty(),
  check('originalAmount', 'Original amount must be a positive number').isFloat({ min: 0 }),
  validatorMiddleware.validate
], adminController.processPurchase);

router.post('/purchase-coupon', [
  authenticate,
  isAdmin,
  check('claimId', 'Claim ID is required').notEmpty(),
  check('originalAmount', 'Original amount must be a positive number').isFloat({ min: 0 }),
  validatorMiddleware.validate
], adminController.processPurchaseWithCoupon);

// Dashboard and system management
router.get('/dashboard', authenticate, isAdmin, adminController.getDashboardData);
router.get('/config', authenticate, isAdmin, adminController.getSystemConfig);
router.put('/config', authenticate, isSuperAdmin, adminController.updateSystemConfig);
router.get('/stats', authenticate, isAdmin, adminController.getSystemStats);
router.patch('/affiliate/:affiliateId/status', [
  authenticate,
  isAdmin,
  check('status', 'Status is required').isIn(['active', 'inactive']),
  validatorMiddleware.validate
], adminController.updateAffiliateStatus);

router.put('/global-settings', authenticate, isAdmin, adminController.updateGlobalSettings);


router.get('/affiliates/pending', authenticate, isAdmin, adminController.getPendingAffiliates);

module.exports = router;

