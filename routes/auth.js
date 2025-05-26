const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { check } = require('express-validator');
const validatorMiddleware = require('../middleware/validator');

// Common login endpoint for both admins and affiliates
router.post('/login', [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists(),
  validatorMiddleware.validate
], authController.login);

router.post('/affiliate/register', [
  check('name', 'Name is required').notEmpty(),
  check('phoneNumber', 'Phone number is required').notEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('address', 'Address is required').notEmpty(),
  check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  validatorMiddleware.validate
], authController.registerAffiliate);

module.exports = router;
