// backend/middleware/auth.js - Enhanced with role-based protection
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Affiliate = require('../models/Affiliate');

// Check if token exists and is valid
exports.authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('x-auth-token');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied', status: 401 });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check token type
    if (decoded.role === 'admin' || decoded.role === 'superadmin') {
      // Admin token
      const admin = await Admin.findById(decoded.id);
      if (!admin) {
        return res.status(401).json({ message: 'Token is not valid', status: 401 });
      }
      
      // Add admin to request object
      req.user = {
        id: admin._id,
        username: admin.username,
        role: admin.role,
        permissions: admin.permissions
      };
    } else if (decoded.role === 'affiliate') {
      // Affiliate token
      const affiliate = await Affiliate.findById(decoded.id);
      if (!affiliate) {
        return res.status(401).json({ message: 'Token is not valid', status: 401 });
      }
      
      // Add affiliate to request object
      req.user = {
        id: affiliate._id,
        name: affiliate.name,
        role: 'affiliate',
        permissions: affiliate.permissions
      };
    } else {
      return res.status(401).json({ message: 'Invalid token role', status: 401 });
    }
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid', status: 401 });
  }
};

// Check if user is admin
exports.isAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
    return res.status(403).json({ message: 'Access denied: Admin role required', status: 403 });
  }
  next();
};

// Check if user is superadmin
exports.isSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Access denied: SuperAdmin role required', status: 403 });
  }
  next();
};

// Check if user is affiliate
exports.isAffiliate = (req, res, next) => {
  if (!req.user || req.user.role !== 'affiliate') {
    return res.status(403).json({ message: 'Access denied: Affiliate role required', status: 403 });
  }
  next();
};

// Check if user has specific permission
exports.hasPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions || !req.user.permissions[permission]) {
      return res.status(403).json({ 
        message: `Access denied: '${permission}' permission required`,
        status: 403
      });
    }
    next();
  };
};

// Check if affiliate owns the resource
exports.isResourceOwner = (resourceModel, resourceParam) => {
  return async (req, res, next) => {
    try {
      if (req.user.role === 'admin' || req.user.role === 'superadmin') {
        // Admins can access all resources
        return next();
      }
      
      const resourceId = req.params[resourceParam] || req.body[resourceParam];
      if (!resourceId) {
        return res.status(400).json({ 
          message: `Resource ID '${resourceParam}' is required`, 
          status: 400 
        });
      }
      
      const resource = await resourceModel.findById(resourceId);
      if (!resource) {
        return res.status(404).json({ message: 'Resource not found', status: 404 });
      }
      
      // Check if resource belongs to affiliate
      if (resource.affiliate && resource.affiliate.toString() === req.user.id.toString()) {
        return next();
      }
      
      res.status(403).json({ 
        message: 'Access denied: You do not own this resource', 
        status: 403 
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message, status: 500 });
    }
  };
};