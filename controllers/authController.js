const Admin = require('../models/Admin');
const Affiliate = require('../models/Affiliate');
const jwt = require('jsonwebtoken');


exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Try to find user in admin collection first
    let user = await Admin.findOne({ email });
    let role = user ? user.role : null; // 'admin' or 'superadmin'
    
    // If not found in admin, try affiliate collection
    if (!user) {
      user = await Affiliate.findOne({ email });
      role = user ? 'affiliate' : null;
      
      // Check affiliate status
      if (user && user.status !== 'active') {
        return res.status(401).json({ 
          message: 'Your account is pending approval or has been rejected. Please contact support for more information.',
          status: 401 
        });
      }
    }
    
    // If user not found in either collection
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials', status: 401 });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials', status: 401 });
    }
    
    // Generate token with role included
    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email, 
        role: role
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    // Return role-specific data
    res.json({
      message: 'Login successful',
      token,
      data: {
        id: user._id,
        name: user.name || user.username, // Admin might have username instead of name
        email: user.email,
        phoneNumber: user.phoneNumber,
        role: role,
        permissions: user.permissions
      },
      status: 200
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message, status: 500 });
  }
};

// In controllers/authController.js - Add affiliate registration
exports.registerAffiliate = async (req, res) => {
  try {
    const { name, phoneNumber, email, address, password } = req.body;
    
    // Check if affiliate with this email already exists
    const existingAffiliate = await Affiliate.findOne({ email });
    if (existingAffiliate) {
      return res.status(400).json({ 
        message: 'An account with this email already exists',
        status: 400
      });
    }
    
    // Create affiliate with 'inactive' status
    const affiliate = new Affiliate({
      name,
      phoneNumber,
      email,
      address,
      password,
      status: 'inactive' // Set status to inactive by default
    });
    
    await affiliate.save();
    
    // Notify admins about new registration
    // This could be via email, notification in admin dashboard, etc.
    // For now, we'll just create a notification record if you have one
    try {
      // If you have a notification system, add code here to notify admins
      console.log(`New affiliate registration: ${name} (${email})`);
    } catch (notificationError) {
      console.error('Failed to send notification:', notificationError);
    }
    
    res.status(201).json({
      message: 'Registration successful. Your account is pending approval by an administrator.',
      data: {
        id: affiliate._id,
        name: affiliate.name,
        email: affiliate.email,
        status: affiliate.status
      },
      status: 201
    });
  } catch (error) {
    console.error('Affiliate registration error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      status: 500
    });
  }
};
