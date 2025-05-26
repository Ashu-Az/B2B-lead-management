// routes/serviceQRCode.js
const express = require('express');
const router = express.Router();
const serviceQRCodeController = require('../controllers/serviceQRCodeController');
const { authenticate, isAdmin } = require('../middleware/auth');
const { check } = require('express-validator');
const validatorMiddleware = require('../middleware/validator');

router.post('/', [
    authenticate,
    isAdmin,
    check('name', 'Name is required').notEmpty(),
    check('services', 'At least one service is required').isArray({ min: 1 }),
    check('frontendUrl', 'Frontend URL is required').notEmpty(),
    validatorMiddleware.validate
  ], serviceQRCodeController.generateServiceQRCode);

router.get('/', authenticate, isAdmin, serviceQRCodeController.getAllServiceQRCodes);

router.get('/stats', authenticate, isAdmin, serviceQRCodeController.getServiceQRCodeStats);

router.get('/:qrCodeId', authenticate, isAdmin, serviceQRCodeController.getServiceQRCodeById);

router.put('/:qrCodeId', [
  authenticate,
  isAdmin,
  validatorMiddleware.validate
], serviceQRCodeController.updateServiceQRCode);

router.delete('/:qrCodeId', authenticate, isAdmin, serviceQRCodeController.deleteServiceQRCode);

module.exports = router;