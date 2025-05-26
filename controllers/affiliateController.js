// backend/controllers/affiliateController.js
const Affiliate = require('../models/Affiliate');
const QRCode = require('../models/QRCode');
const Claim = require('../models/Claim');
const Purchase = require('../models/Purchase');
const jwt = require('jsonwebtoken');
const Coupon = require('../models/Coupon');
const CommissionWithdrawal = require('../models/CommissionWithdrawal');

// Get affiliate by ID
exports.getAffiliateById = async (req, res) => {
  try {
    const { affiliateId } = req.params;
    
    const affiliate = await Affiliate.findById(affiliateId);
    
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }
    
    res.json(affiliate);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get affiliate's QR codes
exports.getQRCodes = async (req, res) => {
  try {
    const { affiliateId } = req.params;
    
    const qrCodes = await QRCode.find({ affiliate: affiliateId }).sort({ createdAt: -1 });
    
    res.json(qrCodes);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getDashboardData = async (req, res) => {
  try {
    const { affiliateId } = req.params;
    
    // Find affiliate with detailed information
    const affiliate = await Affiliate.findById(affiliateId);
    if (!affiliate) {
      return res.status(404).json({ 
        message: 'Affiliate not found', 
        status: 404 
      });
    }
    
    // Get all QR codes generated for this affiliate
    const qrCodes = await QRCode.find({ affiliate: affiliateId });
    const qrCodeIds = qrCodes.map(qr => qr._id);
    
    // Get all coupons generated from these QR codes
    const coupons = await Coupon.find({ 
      qrCode: { $in: qrCodeIds } 
    }).populate('qrCode').sort({ createdAt: -1 });
    
    // Get all claims from these QR codes
    const claims = await Claim.find({ 
      qrCode: { $in: qrCodeIds } 
    }).populate('qrCode').sort({ claimedAt: -1 });
    
    const claimIds = claims.map(claim => claim._id);
    
    // Get all purchases from these claims
    const purchases = await Purchase.find({ 
      claim: { $in: claimIds } 
    }).populate({
      path: 'claim',
      populate: {
        path: 'qrCode'
      }
    }).sort({ purchasedAt: -1 });
    
    // Gather all unique customers with their complete details
    const customerDetails = {};
    
    // First collect customer info from coupons
    coupons.forEach(coupon => {
      const phone = coupon.customerPhone;
      
      if (!customerDetails[phone]) {
        customerDetails[phone] = {
          customerName: coupon.customerName,
          customerPhone: phone,
          coupons: [],
          claims: [],
          purchases: [],
          totalSpent: 0,
          firstInteraction: coupon.createdAt,
          lastInteraction: coupon.createdAt,
          couponsCount: 0,
          claimsCount: 0,
          purchasesCount: 0,
          conversionRate: 0
        };
      }
      
      // Add coupon to customer record
      customerDetails[phone].coupons.push({
        id: coupon._id,
        couponCode: coupon.couponCode,
        status: coupon.status,
        createdAt: coupon.createdAt,
        expiresAt: coupon.expiresAt,
        qrCode: {
          id: coupon.qrCode._id,
          discountPercentage: coupon.qrCode.discountPercentage,
          commissionPercentage: coupon.qrCode.commissionPercentage
        }
      });
      
      customerDetails[phone].couponsCount += 1;
      
      // Update last interaction if this coupon is newer
      if (coupon.createdAt > customerDetails[phone].lastInteraction) {
        customerDetails[phone].lastInteraction = coupon.createdAt;
      }
      
      // Update first interaction if this coupon is older
      if (coupon.createdAt < customerDetails[phone].firstInteraction) {
        customerDetails[phone].firstInteraction = coupon.createdAt;
      }
    });
    
    // Add claim information
    claims.forEach(claim => {
      const phone = claim.customerPhone;
      
      if (customerDetails[phone]) {
        // Add claim to customer record
        customerDetails[phone].claims.push({
          id: claim._id,
          status: claim.status,
          claimedAt: claim.claimedAt,
          qrCode: {
            id: claim.qrCode._id,
            discountPercentage: claim.qrCode.discountPercentage,
            commissionPercentage: claim.qrCode.commissionPercentage
          }
        });
        
        customerDetails[phone].claimsCount += 1;
        
        // Update last interaction if this claim is newer
        if (claim.claimedAt > customerDetails[phone].lastInteraction) {
          customerDetails[phone].lastInteraction = claim.claimedAt;
        }
      }
    });
    
    // Add purchase information
    purchases.forEach(purchase => {
      const phone = purchase.claim.customerPhone;
      
      if (customerDetails[phone]) {
        // Add purchase to customer record
        customerDetails[phone].purchases.push({
          id: purchase._id,
          originalAmount: purchase.originalAmount,
          discountAmount: purchase.discountAmount,
          finalAmount: purchase.finalAmount,
          commissionAmount: purchase.commissionAmount,
          purchasedAt: purchase.purchasedAt
        });
        
        customerDetails[phone].purchasesCount += 1;
        customerDetails[phone].totalSpent += purchase.finalAmount;
        
        // Update last interaction if this purchase is newer
        if (purchase.purchasedAt > customerDetails[phone].lastInteraction) {
          customerDetails[phone].lastInteraction = purchase.purchasedAt;
        }
      }
    });
    
    // Calculate conversion rates for each customer
    Object.values(customerDetails).forEach(customer => {
      customer.conversionRate = customer.couponsCount > 0 
        ? (customer.purchasesCount / customer.couponsCount) * 100 
        : 0;
    });
    
    // Convert customerDetails object to array and sort by totalSpent
    const customerList = Object.values(customerDetails).sort((a, b) => b.totalSpent - a.totalSpent);
    
    // Calculate overall statistics
    const totalCoupons = coupons.length;
    const totalClaims = claims.length;
    const totalPurchases = purchases.length;
    const totalCustomers = Object.keys(customerDetails).length;
    
    // Calculate financial totals
    const totalOriginalAmount = purchases.reduce((sum, p) => sum + p.originalAmount, 0);
    const totalDiscountAmount = purchases.reduce((sum, p) => sum + p.discountAmount, 0);
    const totalFinalAmount = purchases.reduce((sum, p) => sum + p.finalAmount, 0);
    const totalCommission = purchases.reduce((sum, p) => sum + p.commissionAmount, 0);
    
    // Get withdrawals to calculate available balance
    const withdrawals = await CommissionWithdrawal.find({ 
      affiliate: affiliateId,
      status: { $in: ['approved', 'paid'] } 
    });

    const totalWithdrawnAmount = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    
    // Calculate available balance
    const availableCommissionBalance = totalCommission - totalWithdrawnAmount;

    // Calculate conversion rates
    const couponToClaimRate = totalCoupons > 0 ? (totalClaims / totalCoupons) * 100 : 0;
    const claimToPurchaseRate = totalClaims > 0 ? (totalPurchases / totalClaims) * 100 : 0;
    const overallConversionRate = totalCoupons > 0 ? (totalPurchases / totalCoupons) * 100 : 0;
    
    // Generate monthly data for charts
    const monthlyData = {};
    
    // Process coupons by month
    coupons.forEach(coupon => {
      const date = coupon.createdAt;
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = {
          monthYear,
          coupons: 0,
          claims: 0,
          purchases: 0,
          revenue: 0,
          commission: 0
        };
      }
      
      monthlyData[monthYear].coupons += 1;
    });
    
    // Add claims data by month
    claims.forEach(claim => {
      const date = claim.claimedAt;
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = {
          monthYear,
          coupons: 0,
          claims: 0,
          purchases: 0,
          revenue: 0,
          commission: 0
        };
      }
      
      monthlyData[monthYear].claims += 1;
    });
    
    // Add purchase data by month
    purchases.forEach(purchase => {
      const date = purchase.purchasedAt;
      const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = {
          monthYear,
          coupons: 0,
          claims: 0,
          purchases: 0,
          revenue: 0,
          commission: 0
        };
      }
      
      monthlyData[monthYear].purchases += 1;
      monthlyData[monthYear].revenue += purchase.finalAmount;
      monthlyData[monthYear].commission += purchase.commissionAmount;
    });
    
    // Convert monthly data to array and sort by date
    const chartData = Object.values(monthlyData).sort((a, b) => a.monthYear.localeCompare(b.monthYear));
    
    // Get QR code performance metrics
    const qrCodePerformance = await Promise.all(qrCodes.map(async qrCode => {
      const qrCodeImage= qrCode.qrCodeImage;
      const qrCoupons = coupons.filter(c => c.qrCode._id.toString() === qrCode._id.toString());
      const qrClaims = claims.filter(c => c.qrCode._id.toString() === qrCode._id.toString());
      const qrClaimIds = qrClaims.map(c => c._id);
      const qrPurchases = purchases.filter(p => qrClaimIds.includes(p.claim._id));
      
      const qrTotalOriginalAmount = qrPurchases.reduce((sum, p) => sum + p.originalAmount, 0);
      const qrTotalFinalAmount = qrPurchases.reduce((sum, p) => sum + p.finalAmount, 0);
      const qrTotalCommission = qrPurchases.reduce((sum, p) => sum + p.commissionAmount, 0);
      
      return {
        id: qrCode._id,
        discountPercentage: qrCode.discountPercentage,
        commissionPercentage: qrCode.commissionPercentage,
        createdAt: qrCode.createdAt,
        qrCodeImage,
        isActive: qrCode.isActive,
        statistics: {
          couponsCount: qrCoupons.length,
          claimsCount: qrClaims.length,
          purchasesCount: qrPurchases.length,
          conversionRate: qrCoupons.length > 0 ? (qrPurchases.length / qrCoupons.length) * 100 : 0,
          totalOriginalAmount: qrTotalOriginalAmount,
          totalFinalAmount: qrTotalFinalAmount,
          totalCommission: qrTotalCommission
        }
      };
    }));
    
    // Prepare response
    res.json({
      status: 200,
      data: {
        // Affiliate information
        affiliateInfo: {
          id: affiliate._id,
          name: affiliate.name,
          email: affiliate.email,
          phoneNumber: affiliate.phoneNumber,
          address: affiliate.address,
          createdAt: affiliate.createdAt,
          status: affiliate.status,
          role: affiliate.role,
          commissionRate: affiliate.commissionRate || 0
        },
        
        // Summary statistics
        summary: {
          totalQRCodes: qrCodes.length,
          totalCoupons,
          totalClaims,
          totalPurchases,
          totalCustomers,
          
          // Financial summary
          financials: {
            totalOriginalAmount,
            totalDiscountAmount,
            totalFinalAmount,
            totalCommission,
            totalWithdrawnAmount,
          availableCommissionBalance,
            averageDiscount: totalOriginalAmount > 0 ? (totalDiscountAmount / totalOriginalAmount) * 100 : 0,
            averageOrderValue: totalPurchases > 0 ? totalFinalAmount / totalPurchases : 0,
            averageCommissionPerSale: totalPurchases > 0 ? totalCommission / totalPurchases : 0
          },
          
          // Conversion metrics
          conversions: {
            couponToClaimRate,
            claimToPurchaseRate,
            overallConversionRate
          }
        },
        
        // QR code performance
        qrCodes: qrCodePerformance,
        
        // Monthly data for charts
        chartData,
        
        // Customer details
        customers: customerList,
        
        // Recent activity
        recentActivity: {
          coupons: coupons.slice(0, 10), // Last 10 coupons
          claims: claims.slice(0, 10),    // Last 10 claims
          purchases: purchases.slice(0, 10) // Last 10 purchases
        }
      }
    });
  } catch (error) {
    console.error('Get affiliate dashboard error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      status: 500 
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find affiliate by email
    const affiliate = await Affiliate.findOne({ email });
    if (!affiliate) {
      return res.status(401).json({ message: 'Invalid credentials', status: 401 });
    }
    
    // Check password
    const isMatch = await affiliate.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials', status: 401 });
    }
    
    // Generate token with role included
    const token = jwt.sign(
      { 
        id: affiliate._id, 
        email: affiliate.email, 
        role: 'affiliate'  // Always 'affiliate' role
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    // Return role in response
    res.json({
      message: 'Login successful',
      token,
      data: {
        id: affiliate._id,
        name: affiliate.name,
        email: affiliate.email,
        phoneNumber: affiliate.phoneNumber,
        role: 'affiliate',        // Return role to frontend
        permissions: affiliate.permissions  // Return permissions to frontend
      },
      status: 200
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message, status: 500 });
  }
};

exports.getQRCodeDetails = async (req, res) => {
  try {
    const { qrCodeId } = req.params;
    const { affiliateId } = req.params;
    
    // Find QR code and verify it belongs to the affiliate
    const qrCode = await QRCode.findOne({ 
      _id: qrCodeId,
      affiliate: affiliateId
    });
    
    if (!qrCode) {
      return res.status(404).json({ message: 'QR code not found' });
    }
    
    // Get claims and purchases for this QR code
    const claims = await Claim.find({ qrCode: qrCodeId });
    const claimIds = claims.map(claim => claim._id);
    const purchases = await Purchase.find({ claim: { $in: claimIds } });
    
    // Calculate statistics
    const totalClaims = claims.length;
    const totalPurchases = purchases.length;
    const conversionRate = totalClaims > 0 ? (totalPurchases / totalClaims) * 100 : 0;
    const totalCommission = purchases.reduce((sum, purchase) => sum + purchase.commissionAmount, 0);
    
    // Get recent claims
    const recentClaims = await Claim.find({ qrCode: qrCodeId })
      .sort({ claimedAt: -1 })
      .limit(10);
    
    // Get recent purchases
    const recentPurchases = await Purchase.find({ claim: { $in: claimIds } })
      .populate('claim')
      .sort({ purchasedAt: -1 })
      .limit(10);
    
    res.json({
      qrCode,
      statistics: {
        totalClaims,
        totalPurchases,
        conversionRate,
        totalCommission
      },
      recentActivity: {
        claims: recentClaims,
        purchases: recentPurchases
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


exports.updateProfile = async (req, res) => {
  try {
    const { affiliateId } = req.params;
    const { name, phoneNumber, email, address, upiId } = req.body;
    
    // Find affiliate
    const affiliate = await Affiliate.findById(affiliateId);
    
    if (!affiliate) {
      return res.status(404).json({
        message: 'Affiliate not found',
        status: 404
      });
    }
    
    // Validate if email is being changed and already exists
    if (email && email !== affiliate.email) {
      const existingAffiliate = await Affiliate.findOne({ email });
      if (existingAffiliate) {
        return res.status(400).json({
          message: 'Email already in use',
          status: 400
        });
      }
    }
    
    // Update fields if provided
    if (name) affiliate.name = name;
    if (phoneNumber) affiliate.phoneNumber = phoneNumber;
    if (email) affiliate.email = email;
    if (address) affiliate.address = address;
    if (upiId) affiliate.upiId = upiId;
    
    await affiliate.save();
    
    res.json({
      message: 'Profile updated successfully',
      data: {
        id: affiliate._id,
        name: affiliate.name,
        email: affiliate.email,
        phoneNumber: affiliate.phoneNumber,
        address: affiliate.address,
        upiId: affiliate.upiId
      },
      status: 200
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      status: 500
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { affiliateId } = req.params;
    const { currentPassword, newPassword } = req.body;
    
    // Find affiliate
    const affiliate = await Affiliate.findById(affiliateId);
    
    if (!affiliate) {
      return res.status(404).json({ message: 'Affiliate not found' });
    }
    
    // Verify current password
    const isMatch = await affiliate.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    // Update password
    affiliate.password = newPassword;
    await affiliate.save();
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getCommissionBalance = async (req, res) => {
  try {
    const { affiliateId } = req.params;
    
    // Verify affiliate exists
    const affiliate = await Affiliate.findById(affiliateId);
    if (!affiliate) {
      return res.status(404).json({ 
        message: 'Affiliate not found',
        status: 404
      });
    }
    
    // Get all QR codes for this affiliate
    const qrCodes = await QRCode.find({ affiliate: affiliateId });
    const qrCodeIds = qrCodes.map(qr => qr._id);
    
    // Get all claims associated with these QR codes
    const claims = await Claim.find({ qrCode: { $in: qrCodeIds } });
    const claimIds = claims.map(claim => claim._id);
    
    // Get all purchases associated with these claims
    const purchases = await Purchase.find({ claim: { $in: claimIds } });
    
    // Calculate total commission earned
    const totalCommission = purchases.reduce((sum, purchase) => sum + purchase.commissionAmount, 0);
    
    // Get all approved withdrawals
    const withdrawals = await CommissionWithdrawal.find({ 
      affiliate: affiliateId,
      status: { $in: ['approved', 'paid'] }
    });
    
    // Calculate total withdrawn amount
    const totalWithdrawn = withdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
    
    // Calculate available balance
    const availableBalance = totalCommission - totalWithdrawn;
    
    // Get pending withdrawal requests
    const pendingWithdrawals = await CommissionWithdrawal.find({
      affiliate: affiliateId,
      status: 'pending'
    });
    
    // Calculate pending withdrawal amount
    const pendingAmount = pendingWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
    
    res.json({
      data: {
        totalCommission,
        totalWithdrawn,
        availableBalance,
        pendingAmount,
        pendingRequests: pendingWithdrawals.length
      },
      status: 200
    });
  } catch (error) {
    console.error('Get commission balance error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      status: 500
    });
  }
};

// Request commission withdrawal
exports.requestWithdrawal = async (req, res) => {
  try {
    const { affiliateId } = req.params;
    const { amount, upiId, notes } = req.body;
    
    // Validate input
    if (!amount || !upiId) {
      return res.status(400).json({
        message: 'Amount and UPI ID are required',
        status: 400
      });
    }
    
    if (amount <= 0) {
      return res.status(400).json({
        message: 'Amount must be greater than zero',
        status: 400
      });
    }
    
    // Verify affiliate exists
    const affiliate = await Affiliate.findById(affiliateId);
    if (!affiliate) {
      return res.status(404).json({ 
        message: 'Affiliate not found',
        status: 404
      });
    }
    
    // Check if affiliate is active
    if (affiliate.status !== 'active') {
      return res.status(400).json({
        message: 'Inactive affiliates cannot request withdrawals',
        status: 400
      });
    }
    
    // Check available balance
    // Get all QR codes for this affiliate
    const qrCodes = await QRCode.find({ affiliate: affiliateId });
    const qrCodeIds = qrCodes.map(qr => qr._id);
    
    // Get all claims associated with these QR codes
    const claims = await Claim.find({ qrCode: { $in: qrCodeIds } });
    const claimIds = claims.map(claim => claim._id);
    
    // Get all purchases associated with these claims
    const purchases = await Purchase.find({ claim: { $in: claimIds } });
    
    // Calculate total commission earned
    const totalCommission = purchases.reduce((sum, purchase) => sum + purchase.commissionAmount, 0);
    
    // Get all approved withdrawals
    const withdrawals = await CommissionWithdrawal.find({ 
      affiliate: affiliateId,
      status: { $in: ['approved', 'paid'] }
    });
    
    // Calculate total withdrawn amount
    const totalWithdrawn = withdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
    
    // Calculate available balance
    const availableBalance = totalCommission - totalWithdrawn;
    
    // Check if requested amount exceeds available balance
    if (amount > availableBalance) {
      return res.status(400).json({
        message: 'Requested amount exceeds available balance',
        availableBalance,
        status: 400
      });
    }
    
    // Create withdrawal request
    const withdrawal = new CommissionWithdrawal({
      affiliate: affiliateId,
      amount,
      upiId,
      notes,
      status: 'pending',
      requestDate: new Date()
    });
    
    await withdrawal.save();
    
    res.status(201).json({
      message: 'Withdrawal request submitted successfully',
      data: {
        withdrawalId: withdrawal._id,
        amount,
        upiId,
        status: 'pending',
        requestDate: withdrawal.requestDate
      },
      status: 201
    });
  } catch (error) {
    console.error('Request withdrawal error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      status: 500
    });
  }
};


exports.getWithdrawalHistory = async (req, res) => {
  try {
    const { affiliateId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    
    // Verify affiliate exists
    const affiliate = await Affiliate.findById(affiliateId);
    if (!affiliate) {
      return res.status(404).json({ 
        message: 'Affiliate not found',
        status: 404
      });
    }
    
    // Create filter
    const filter = { affiliate: affiliateId };
    
    // Add status filter if provided
    if (status && ['pending', 'approved', 'rejected', 'paid'].includes(status)) {
      filter.status = status;
    }
    
    // Get total count for pagination
    const totalCount = await CommissionWithdrawal.countDocuments(filter);
    
    // Get withdrawals with pagination
    const withdrawals = await CommissionWithdrawal.find(filter)
      .populate('processedBy', 'name email')
      .sort({ requestDate: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    
    res.json({
      data: withdrawals,
      pagination: {
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit)),
        page: parseInt(page),
        limit: parseInt(limit)
      },
      status: 200
    });
  } catch (error) {
    console.error('Get withdrawal history error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      status: 500
    });
  }
};

// Cancel withdrawal request (only if pending)
exports.cancelWithdrawalRequest = async (req, res) => {
  try {
    const { affiliateId, withdrawalId } = req.params;
    
    // Find the withdrawal request
    const withdrawal = await CommissionWithdrawal.findOne({
      _id: withdrawalId,
      affiliate: affiliateId
    });
    
    if (!withdrawal) {
      return res.status(404).json({
        message: 'Withdrawal request not found',
        status: 404
      });
    }
    
    // Check if the request is still pending
    if (withdrawal.status !== 'pending') {
      return res.status(400).json({
        message: `Cannot cancel a ${withdrawal.status} withdrawal request`,
        status: 400
      });
    }
    
    // Delete the withdrawal request
    await CommissionWithdrawal.deleteOne({ _id: withdrawalId });
    
    res.json({
      message: 'Withdrawal request cancelled successfully',
      status: 200
    });
  } catch (error) {
    console.error('Cancel withdrawal request error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      status: 500
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const { affiliateId } = req.params;
    
    console.log('User in request:', req.user);
    console.log('Affiliate ID requested:', affiliateId);
    console.log('User ID type:', typeof req.user.id);
    console.log('Affiliate ID type:', typeof affiliateId);
    
    // Convert both to strings for comparison
    const userIdString = req.user.id.toString();
    const affiliateIdString = affiliateId.toString();
    
    console.log('User ID as string:', userIdString);
    console.log('Affiliate ID as string:', affiliateIdString);
    console.log('Do they match?', userIdString === affiliateIdString);
    
    // Check if user is requesting their own profile or is an admin
    if (userIdString !== affiliateIdString && req.user.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied',
        status: 403
      });
    }
    
    // Find affiliate
    const affiliate = await Affiliate.findById(affiliateId);
    
    if (!affiliate) {
      return res.status(404).json({
        message: 'Affiliate not found',
        status: 404
      });
    }
    
    // Return profile data
    res.json({
      data: {
        id: affiliate._id,
        name: affiliate.name,
        email: affiliate.email,
        phoneNumber: affiliate.phoneNumber,
        address: affiliate.address,
        upiId: affiliate.upiId || '',
        status: affiliate.status,
        createdAt: affiliate.createdAt
      },
      status: 200
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      status: 500
    });
  }
};
