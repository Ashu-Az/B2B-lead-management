// backend/routes/customer.js
const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

// QR code and coupon routes
router.get('/qrcode', customerController.processQRCode);
router.post('/qrcode', customerController.processQRCode);
router.post('/coupon', customerController.generateCoupon);
router.post('/verify-coupon', customerController.verifyCoupon);
router.post('/claim-coupon', customerController.createClaim);
router.get('/service-portal', customerController.processServiceQRCode);

module.exports = router;
