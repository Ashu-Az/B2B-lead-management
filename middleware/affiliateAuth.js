const jwt = require('jsonwebtoken');
const Affiliate = require('../models/Affiliate');

module.exports = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('x-auth-token');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is for an affiliate
    if (!decoded.id) {
      return res.status(401).json({ message: 'Token is not valid' });
    }
    
    // Find affiliate by ID
    const affiliate = await Affiliate.findById(decoded.id);
    
    if (!affiliate) {
      return res.status(401).json({ message: 'Token is not valid' });
    }
    
    // Add affiliate to request object
    req.affiliate = {
      id: affiliate._id,
      name: affiliate.name
    };
    
    // Check if the requested affiliate ID matches the token's affiliate ID
    if (req.params.affiliateId && req.params.affiliateId !== affiliate._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};