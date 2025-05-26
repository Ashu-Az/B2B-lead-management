// routes/service.js
const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { authenticate, isAdmin } = require('../middleware/auth');
const { check } = require('express-validator');
const validatorMiddleware = require('../middleware/validator');

// Admin routes (protected)
router.post('/', [
  authenticate,
  isAdmin,
  check('name', 'Name is required').notEmpty(),
  check('serviceType', 'Service type is required').notEmpty(),
  check('serviceData', 'Service data is required').notEmpty(),
  validatorMiddleware.validate
], serviceController.createService);

router.get('/', authenticate, isAdmin, serviceController.getAllServices);

router.get('/types', authenticate, isAdmin, serviceController.getServiceTypes);

router.get('/:serviceId', authenticate, isAdmin, serviceController.getServiceById);

router.put('/:serviceId', [
  authenticate,
  isAdmin,
  validatorMiddleware.validate
], serviceController.updateService);

router.delete('/:serviceId', authenticate, isAdmin, serviceController.deleteService);

module.exports = router;