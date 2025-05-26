const Admin = require("../models/Admin");
const Affiliate = require("../models/Affiliate");
const QRCode = require("../models/QRCode");
const Claim = require("../models/Claim");
const Purchase = require("../models/Purchase");
const Coupon = require("../models/Coupon"); 
const SystemConfig = require("../models/SystemConfig"); 
const jwt = require("jsonwebtoken");
const qrcode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose"); 
const { response } = require("express");
const CommissionWithdrawal = require("../models/CommissionWithdrawal");


exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find admin by email instead of username for consistency
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res
        .status(401)
        .json({ message: "Invalid credentials", status: 401 });
    }

    // Check password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "Invalid credentials", status: 401 });
    }

    // Generate token with role included
    const token = jwt.sign(
      {
        id: admin._id,
        email: admin.email,
        role: admin.role, // Include role in token
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Return role in response
    res.json({
      message: "Login successful",
      token,
      data: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role, 
        permissions: admin.permissions, 
      },
      status: 200,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Server error", error: error.message, status: 500 });
  }
};

// Create admin account (for initial setup)
exports.register = async (req, res) => {
  try {
    const { username, password, email, name } = req.body;

    // Check if admin already exists
    let admin = await Admin.findOne({ $or: [{ username }, { email }] });
    if (admin) {
      return res.status(400).json({ message: "Admin already exists" });
    }
    // Create new admin
    admin = new Admin({
      username,
      password,
      email,
      name,
    });

    await admin.save();

    res.status(201).json({ message: "Admin created successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.createAffiliate = async (req, res) => {
  try {
    const { name, phoneNumber, email, address, password } = req.body;

    // Check if affiliate with this email already exists
    const existingAffiliate = await Affiliate.findOne({ email });
    if (existingAffiliate) {
      return res
        .status(400)
        .json({ message: "Affiliate with this email already exists" });
    }

    // Create affiliate with default password if none provided
    const affiliatePassword = password || "affiliate123";

    // Create affiliate
    const affiliate = new Affiliate({
      name,
      phoneNumber,
      email,
      address,
      password: affiliatePassword, // Ensure password is always set
    });

    await affiliate.save();

    res.status(201).json({
      message: "Affiliate created successfully",
      affiliate: {
        id: affiliate._id,
        name: affiliate.name,
        phoneNumber: affiliate.phoneNumber,
        email: affiliate.email,
        address: affiliate.address,
      },
      initialPassword: password ? undefined : affiliatePassword, // Only return default password
    });
  } catch (error) {
    console.error("Create affiliate error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all affiliates with commission and discount percentages
exports.getAllAffiliates = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query; // Get status from query parameter
    
    // Create filter object
    const filter = {};
    
    // If status is specified, add it to filter
    if (status && ["active", "inactive"].includes(status)) {
      filter.status = status;
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Find affiliates with filter and pagination
    const affiliates = await Affiliate.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const totalCount = await Affiliate.countDocuments(filter);
    
    // Add commission and discount percentages to each affiliate
    const affiliatesWithCommission = await Promise.all(
      affiliates.map(async (affiliate) => {
        // Find the latest QR code for this affiliate to get commission/discount percentages
        const latestQRCode = await QRCode.findOne({ 
          affiliate: affiliate._id 
        }).sort({ createdAt: -1 });
        
        // Convert Mongoose document to plain object
        const affiliateObj = affiliate.toObject();
        
        // Add commission and discount percentages from latest QR code if available
        affiliateObj.commissionPercentage = latestQRCode ? 
          latestQRCode.commissionPercentage : 0;
        affiliateObj.discountPercentage = latestQRCode ? 
          latestQRCode.discountPercentage : 0;
        
        return affiliateObj;
      })
    );
    
    res.json({
      data: affiliatesWithCommission,
      count: totalCount,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      status: 200,
    });
  } catch (error) {
    console.error("Get all affiliates error:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message, status: 500 });
  }
};

exports.generateQRCode = async (req, res) => {
  try {
    const {
      affiliateId,
      discountPercentage,
      commissionPercentage,
      frontendUrl,
    } = req.body;

    // Check if affiliate exists
    const affiliate = await Affiliate.findById(affiliateId);
    if (!affiliate) {
      return res.status(404).json({ message: "Affiliate not found" });
    }

    // Validate frontend URL
    if (!frontendUrl) {
      return res
        .status(400)
        .json({ message: "Frontend URL is required to redirect customers" });
    }

    // Generate unique identifier for QR code
    const uniqueId = uuidv4();

    // Create QR code data
    const qrData = {
      affiliateId,
      discountPercentage,
      commissionPercentage,
      uniqueId,
    };

    // Convert to JSON string
    const qrDataString = JSON.stringify(qrData);

    // Generate temporary unique ID for the URL
    // We'll update this with the real DB ID after saving
    const tempId = uuidv4();

    // Create redirect URL with this temporary ID
    const redirectUrl = `${frontendUrl}?qrCodeId=${tempId}`;

    // Generate QR code image with redirect URL
    const qrCodeImage = await qrcode.toDataURL(redirectUrl);

    // Create QR code in database with all required fields
    const qrCodeEntry = new QRCode({
      affiliate: affiliateId,
      discountPercentage,
      commissionPercentage,
      qrCodeData: qrDataString,
      qrCodeImage, // Set the image before saving
      redirectUrl,
      isActive: true,
    });

    // Save the QR code
    await qrCodeEntry.save();

    // Now update the redirect URL with the real DB ID
    const finalRedirectUrl = `${frontendUrl}?qrCodeId=${qrCodeEntry._id}`;

    // Generate final QR code with the real ID
    const finalQrCodeImage = await qrcode.toDataURL(finalRedirectUrl);

    // Update the QR code entry
    qrCodeEntry.redirectUrl = finalRedirectUrl;
    qrCodeEntry.qrCodeImage = finalQrCodeImage;
    await qrCodeEntry.save();

    res.status(201).json({
      message: "QR code generated successfully",
      qrCode: qrCodeEntry,
    });
  } catch (error) {
    console.error("QR Code generation error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get QR codes for a specific affiliate
exports.getAffiliateQRCodes = async (req, res) => {
  try {
    const { affiliateId } = req.params;

    const qrCodes = await QRCode.find({ affiliate: affiliateId }).sort({
      createdAt: -1,
    });

    res.json(qrCodes);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Process purchase
exports.processPurchase = async (req, res) => {
  try {
    const { claimId, originalAmount } = req.body;

    // Find claim
    const claim = await Claim.findById(claimId).populate("qrCode");

    if (!claim) {
      return res.status(404).json({ message: "Claim not found" });
    }

    if (claim.status !== "claimed") {
      return res
        .status(400)
        .json({ message: "Claim already processed or expired" });
    }

    // Get discount and commission percentages from the QR code
    const { discountPercentage, commissionPercentage } = claim.qrCode;

    // Calculate discount amount
    const discountAmount = (originalAmount * discountPercentage) / 100;

    // Calculate final amount after discount
    const finalAmount = originalAmount - discountAmount;

    // Calculate commission amount based on the final amount
    const commissionAmount = (finalAmount * commissionPercentage) / 100;

    // Create purchase record
    const purchase = new Purchase({
      claim: claimId,
      originalAmount,
      discountPercentage,
      discountAmount,
      finalAmount,
      commissionPercentage,
      commissionAmount,
    });

    await purchase.save();

    // Update claim status
    claim.status = "purchased";
    await claim.save();

    res.status(201).json({
      message: "Purchase processed successfully",
      purchase,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getDashboardData = async (req, res) => {
  try {
    // Get pagination parameters
    const { page = 1, limit = 10 } = req.query;
    const customerSkip = (parseInt(page) - 1) * parseInt(limit);

    // Basic counts
    const adminCount = await Admin.countDocuments();
    const affiliateCount = await Affiliate.countDocuments({ status: "active" });

    // Get active affiliates
    const activeAffiliates = await Affiliate.find({ status: "active" }).sort({
      createdAt: -1,
    });
    const activeAffiliateIds = activeAffiliates.map(
      (affiliate) => affiliate._id
    );

    // QR codes and related counts
    const qrCodes = await QRCode.find({
      affiliate: { $in: activeAffiliateIds },
    });
    const qrCodeIds = qrCodes.map((qr) => qr._id);
    const qrCodeCount = qrCodes.length;

    // Get counts
    const couponCount = await Coupon.countDocuments({
      qrCode: { $in: qrCodeIds },
    });
    const claimCount = await Claim.countDocuments({
      qrCode: { $in: qrCodeIds },
    });

    // Get claims and purchases
    const claims = await Claim.find({ qrCode: { $in: qrCodeIds } });
    const claimIds = claims.map((claim) => claim._id);
    const purchases = await Purchase.find({ claim: { $in: claimIds } });
    const purchaseCount = purchases.length;

    // Get customer data with pagination and safe population
    const allClaims = await Claim.find()
      .populate({
        path: "qrCode",
        populate: {
          path: "affiliate",
        },
      })
      .sort({ claimedAt: -1 })
      .skip(customerSkip)
      .limit(parseInt(limit));

    const totalCustomerCount = await Claim.countDocuments();

    // Process customer data with null checks
    const allCustomersData = [];
    for (const claim of allClaims) {
      try {
        if (!claim) continue;

        const purchases = await Purchase.find({ claim: claim._id });
        const totalSpent = purchases.reduce((sum, p) => sum + p.finalAmount, 0);

        // Safe object construction with null checks
        const customerData = {
          id: claim._id,
          customerName: claim.customerName || "Unknown",
          customerPhone: claim.customerPhone || "Unknown",
          claimedAt: claim.claimedAt,
          status: claim.status,
        };

        // Only add affiliate data if it exists
        if (claim.qrCode && claim.qrCode.affiliate) {
          customerData.affiliate = {
            id: claim.qrCode.affiliate._id,
            name: claim.qrCode.affiliate.name || "Unknown",
            email: claim.qrCode.affiliate.email || "Unknown",
            phoneNumber: claim.qrCode.affiliate.phoneNumber || "Unknown",
          };
        } else {
          customerData.affiliate = null;
        }

        // Only add QR code data if it exists
        if (claim.qrCode) {
          customerData.qrCode = {
            id: claim.qrCode._id,
            discountPercentage: claim.qrCode.discountPercentage || 0,
            commissionPercentage: claim.qrCode.commissionPercentage || 0,
          };
        } else {
          customerData.qrCode = null;
        }

        customerData.purchasesCount = purchases.length;
        customerData.totalSpent = totalSpent;

        allCustomersData.push(customerData);
      } catch (err) {
        console.error("Error processing customer data:", err);
        // Continue to next claim
      }
    }

    // Affiliate performance data with error handling
    const affiliateData = [];
    for (const affiliate of activeAffiliates) {
      try {
        // Get QR codes for this affiliate
        const affiliateQrCodes = await QRCode.find({
          affiliate: affiliate._id,
        });
        const affiliateQrCodeIds = affiliateQrCodes.map((qr) => qr._id);

        // Get related data
        const coupons = await Coupon.find({
          qrCode: { $in: affiliateQrCodeIds },
        });
        const affiliateClaims = await Claim.find({
          qrCode: { $in: affiliateQrCodeIds },
        });
        const affiliateClaimIds = affiliateClaims.map((claim) => claim._id);
        const affiliatePurchases = await Purchase.find({
          claim: { $in: affiliateClaimIds },
        });

        // Calculate statistics
        const totalCoupons = coupons.length;
        const totalClaims = affiliateClaims.length;
        const totalPurchases = affiliatePurchases.length;
        const conversionRate =
          totalCoupons > 0 ? (totalPurchases / totalCoupons) * 100 : 0;
        const totalCommission = affiliatePurchases.reduce(
          (sum, p) => sum + p.commissionAmount,
          0
        );
        const totalSales = affiliatePurchases.reduce(
          (sum, p) => sum + p.finalAmount,
          0
        );

        // Get withdrawals for calculating available commission
        const withdrawals = await CommissionWithdrawal.find({
          affiliate: affiliate._id,
          status: { $in: ["approved", "paid"] },
        });

        const totalWithdrawnAmount = withdrawals.reduce(
          (sum, w) => sum + w.amount,
          0
        );
        const availableCommissionBalance =
          totalCommission - totalWithdrawnAmount;

        affiliateData.push({
          affiliateId: affiliate._id,
          name: affiliate.name,
          email: affiliate.email,
          phoneNumber: affiliate.phoneNumber,
          status: affiliate.status,
          createdAt: affiliate.createdAt,
          qrCodesCount: affiliateQrCodes.length,
          couponsCount: totalCoupons,
          claimsCount: totalClaims,
          purchasesCount: totalPurchases,
          conversionRate,
          totalCommission,
          availableCommissionBalance,
          totalWithdrawnAmount,
          totalSales,
        });
      } catch (err) {
        console.error(
          `Error processing affiliate data for ${affiliate._id}:`,
          err
        );
        // Continue to next affiliate
      }
    }

    // Sort affiliates by performance
    const topAffiliates = [...affiliateData].sort(
      (a, b) => b.totalCommission - a.totalCommission
    );

    // Financial data calculation
    const totalSales = purchases.reduce((sum, p) => sum + p.finalAmount, 0);
    const totalOriginalAmount = purchases.reduce(
      (sum, p) => sum + p.originalAmount,
      0
    );
    const totalDiscountAmount = purchases.reduce(
      (sum, p) => sum + p.discountAmount,
      0
    );
    const totalCommissions = purchases.reduce(
      (sum, p) => sum + p.commissionAmount,
      0
    );

    // Global lead tracking
    let globalLeadsCount = 0;
    let globalLeadsPurchaseCount = 0;
    let globalLeadsRevenue = 0;

    try {
      const globalAffiliate = await Affiliate.findOne({
        email: "global@system.com",
      });
      if (globalAffiliate) {
        const globalQRCode = await QRCode.findOne({
          affiliate: globalAffiliate._id,
        });
        if (globalQRCode) {
          const globalCoupons = await Coupon.find({ qrCode: globalQRCode._id });
          globalLeadsCount = globalCoupons.length;

          const globalClaimIds = await Claim.find({
            qrCode: globalQRCode._id,
          }).distinct("_id");
          if (globalClaimIds.length > 0) {
            const globalPurchases = await Purchase.find({
              claim: { $in: globalClaimIds },
            });
            globalLeadsPurchaseCount = globalPurchases.length;
            globalLeadsRevenue = globalPurchases.reduce(
              (sum, p) => sum + p.finalAmount,
              0
            );
          }
        }
      }
    } catch (err) {
      console.error("Error processing global leads:", err);
    }

    // Recent activity
    const recentPurchases = await Purchase.find({ claim: { $in: claimIds } })
      .populate({
        path: "claim",
        populate: {
          path: "qrCode",
          populate: {
            path: "affiliate",
          },
        },
      })
      .sort({ purchasedAt: -1 })
      .limit(10);

    const recentCoupons = await Coupon.find({ qrCode: { $in: qrCodeIds } })
      .populate({
        path: "qrCode",
        populate: {
          path: "affiliate",
        },
      })
      .sort({ createdAt: -1 })
      .limit(10);

    const recentClaims = await Claim.find({ qrCode: { $in: qrCodeIds } })
      .populate({
        path: "qrCode",
        populate: {
          path: "affiliate",
        },
      })
      .sort({ claimedAt: -1 })
      .limit(10);

    // Customer data
    const customerPhones = [
      ...new Set(
        await Coupon.find({ qrCode: { $in: qrCodeIds } }).distinct(
          "customerPhone"
        )
      ),
    ];
    const customersCount = customerPhones.length;

    // Monthly chart data
    const monthlyData = {};
    for (const purchase of purchases) {
      try {
        const date = purchase.purchasedAt;
        if (!date) continue;

        const monthYear = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;

        if (!monthlyData[monthYear]) {
          monthlyData[monthYear] = {
            monthYear,
            coupons: 0,
            claims: 0,
            purchases: 0,
            sales: 0,
            commission: 0,
          };
        }

        monthlyData[monthYear].purchases += 1;
        monthlyData[monthYear].sales += purchase.finalAmount;
        monthlyData[monthYear].commission += purchase.commissionAmount;
      } catch (err) {
        console.error("Error processing purchase for chart data:", err);
      }
    }

    // Add coupon and claim data to charts
    try {
      for (const coupon of await Coupon.find({ qrCode: { $in: qrCodeIds } })) {
        const date = coupon.createdAt;
        if (!date) continue;

        const monthYear = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;

        if (!monthlyData[monthYear]) {
          monthlyData[monthYear] = {
            monthYear,
            coupons: 0,
            claims: 0,
            purchases: 0,
            sales: 0,
            commission: 0,
          };
        }

        monthlyData[monthYear].coupons += 1;
      }

      for (const claim of claims) {
        const date = claim.claimedAt;
        if (!date) continue;

        const monthYear = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;

        if (!monthlyData[monthYear]) {
          monthlyData[monthYear] = {
            monthYear,
            coupons: 0,
            claims: 0,
            purchases: 0,
            sales: 0,
            commission: 0,
          };
        }

        monthlyData[monthYear].claims += 1;
      }
    } catch (err) {
      console.error("Error processing coupon/claim data for charts:", err);
    }

    // Convert to array and sort
    const chartData = Object.values(monthlyData).sort((a, b) =>
      a.monthYear.localeCompare(b.monthYear)
    );

    // Coupon status breakdown
    let couponStatusCounts = {
      generated: 0,
      verified: 0,
      claimed: 0,
      used: 0,
      expired: 0,
    };

    try {
      couponStatusCounts = {
        generated: await Coupon.countDocuments({
          qrCode: { $in: qrCodeIds },
          status: "generated",
        }),
        verified: await Coupon.countDocuments({
          qrCode: { $in: qrCodeIds },
          status: "verified",
        }),
        claimed: await Coupon.countDocuments({
          qrCode: { $in: qrCodeIds },
          status: "claimed",
        }),
        used: await Coupon.countDocuments({
          qrCode: { $in: qrCodeIds },
          status: "used",
        }),
        expired: await Coupon.countDocuments({
          qrCode: { $in: qrCodeIds },
          status: "expired",
        }),
      };
    } catch (err) {
      console.error("Error getting coupon status counts:", err);
    }

    // Return response
    res.json({
      status: 200,
      data: {
        counts: {
          admins: adminCount,
          affiliates: affiliateCount,
          qrCodes: qrCodeCount,
          coupons: couponCount,
          claims: claimCount,
          purchases: purchaseCount,
          customers: customersCount,
        },
        globalLeads: {
          totalCount: globalLeadsCount,
          purchasesCount: globalLeadsPurchaseCount,
          revenue: globalLeadsRevenue,
          conversionRate:
            globalLeadsCount > 0
              ? (globalLeadsPurchaseCount / globalLeadsCount) * 100
              : 0,
        },
        financials: {
          totalSales,
          totalOriginalAmount,
          totalDiscountAmount,
          totalCommissions,
          averageSale: purchaseCount > 0 ? totalSales / purchaseCount : 0,
          averageCommission:
            purchaseCount > 0 ? totalCommissions / purchaseCount : 0,
          discountPercentage:
            totalOriginalAmount > 0
              ? (totalDiscountAmount / totalOriginalAmount) * 100
              : 0,
        },
        affiliatePerformance: {
          all: affiliateData,
          top: topAffiliates.slice(0, 5),
        },
        conversionRates: {
          couponToClaimRate:
            couponCount > 0 ? (claimCount / couponCount) * 100 : 0,
          claimToPurchaseRate:
            claimCount > 0 ? (purchaseCount / claimCount) * 100 : 0,
          overallConversionRate:
            couponCount > 0 ? (purchaseCount / couponCount) * 100 : 0,
        },
        statusBreakdown: couponStatusCounts,
        chartData,
        customers: {
          data: allCustomersData,
          pagination: {
            total: totalCustomerCount,
            pages: Math.ceil(totalCustomerCount / parseInt(limit)),
            page: parseInt(page),
            limit: parseInt(limit),
          },
        },
        recentActivity: {
          purchases: recentPurchases,
          coupons: recentCoupons,
          claims: recentClaims,
        },
      },
    });
  } catch (error) {
    console.error("Get admin dashboard error:", error);
    res
      .status(500)
      .json({ message: "Server error", error: error.message, status: 500 });
  }
};

exports.processPurchaseWithCoupon = async (req, res) => {
  try {
    const { claimId, originalAmount } = req.body;

    // Find claim
    const claim = await Claim.findById(claimId).populate("qrCode");

    if (!claim) {
      return res.status(404).json({ message: "Claim not found" });
    }

    if (claim.status !== "claimed") {
      return res
        .status(400)
        .json({ message: "Claim already processed or expired" });
    }

    // Get discount and commission percentages from the QR code
    const { discountPercentage, commissionPercentage } = claim.qrCode;

    // Calculate discount amount
    const discountAmount = (originalAmount * discountPercentage) / 100;

    // Calculate final amount after discount
    const finalAmount = originalAmount - discountAmount;

    // Calculate commission amount based on the final amount
    const commissionAmount = (finalAmount * commissionPercentage) / 100;

    // Create purchase record
    const purchase = new Purchase({
      claim: claimId,
      originalAmount,
      discountPercentage,
      discountAmount,
      finalAmount,
      commissionPercentage,
      commissionAmount,
    });

    await purchase.save();

    // Update claim status
    claim.status = "purchased";
    await claim.save();

    // Update any coupon associated with this claim
    const coupon = await Coupon.findOne({
      qrCode: claim.qrCode,
      customerPhone: claim.customerPhone,
      status: "claimed",
    });

    if (coupon) {
      coupon.status = "used";
      await coupon.save();
    }

    res.status(201).json({
      message: "Purchase processed successfully",
      purchase,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// In adminController.js - Update the updateAffiliateStatus function
exports.updateAffiliateStatus = async (req, res) => {
  try {
    const { affiliateId } = req.params;
    const { status, notes } = req.body;
    
    // Validate input
    if (!status || !['active', 'inactive', 'rejected'].includes(status)) {
      return res.status(400).json({
        message: 'Status must be "active", "inactive", or "rejected"',
        status: 400
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
    
    // Update status
    const previousStatus = affiliate.status;
    affiliate.status = status;
    
    // Add approval/rejection notes if provided
    if (notes) {
      affiliate.statusNotes = notes;
    }
    
    // Add approval/rejection timestamp and admin
    affiliate.statusUpdatedAt = new Date();
    affiliate.statusUpdatedBy = req.user.id;
    
    await affiliate.save();
    
    // If this is an approval (inactive -> active), send a notification to the affiliate
    if (previousStatus === 'inactive' && status === 'active') {
      try {
        // Add notification code here (email, SMS, etc.)
        console.log(`Affiliate ${affiliate.name} (${affiliate.email}) has been approved`);
      } catch (notificationError) {
        console.error('Failed to send approval notification:', notificationError);
      }
    }
    
    res.json({
      message: `Affiliate status updated to ${status}`,
      data: {
        id: affiliate._id,
        name: affiliate.name,
        email: affiliate.email,
        status: affiliate.status,
        statusNotes: affiliate.statusNotes,
        statusUpdatedAt: affiliate.statusUpdatedAt
      },
      status: 200
    });
  } catch (error) {
    console.error('Update affiliate status error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      status: 500
    });
  }
};

exports.updateAffiliate = async (req, res) => {
  try {
    const { affiliateId } = req.params;
    const { name, phoneNumber, email, address } = req.body;

    // Find affiliate
    const affiliate = await Affiliate.findById(affiliateId);

    if (!affiliate) {
      return res.status(404).json({ message: "Affiliate not found" });
    }

    // Update fields if provided
    if (name) affiliate.name = name;
    if (phoneNumber) affiliate.phoneNumber = phoneNumber;
    if (email) affiliate.email = email;
    if (address) affiliate.address = address;

    await affiliate.save();

    res.json({
      message: "Affiliate updated successfully",
      affiliate: {
        id: affiliate._id,
        name: affiliate.name,
        phoneNumber: affiliate.phoneNumber,
        email: affiliate.email,
        address: affiliate.address,
      },
    });
  } catch (error) {
    console.error("Update affiliate error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getAffiliate = async (req, res) => {
  try {
    const { affiliateId } = req.params;

    const affiliate = await Affiliate.findById(affiliateId);

    if (!affiliate) {
      return res.status(404).json({ message: "Affiliate not found" });
    }

    res.json({
      id: affiliate._id,
      name: affiliate.name,
      phoneNumber: affiliate.phoneNumber,
      email: affiliate.email,
      address: affiliate.address,
      createdAt: affiliate.createdAt,
    });
  } catch (error) {
    console.error("Get affiliate error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete affiliate
exports.deleteAffiliate = async (req, res) => {
  try {
    const { affiliateId } = req.params;

    const affiliate = await Affiliate.findById(affiliateId);

    if (!affiliate) {
      return res.status(404).json({ message: "Affiliate not found" });
    }

    // Check if affiliate has any QR codes
    const qrCodes = await QRCode.find({ affiliate: affiliateId });

    if (qrCodes.length > 0) {
      return res.status(400).json({
        message:
          "Cannot delete affiliate with existing QR codes. Deactivate QR codes first.",
      });
    }

    await affiliate.remove();

    res.json({ message: "Affiliate deleted successfully" });
  } catch (error) {
    console.error("Delete affiliate error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getAllQRCodes = async (req, res) => {
  try {
    // Support pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalCount = await QRCode.countDocuments();

    // Get QR codes with affiliate information
    const qrCodes = await QRCode.find()
      .populate("affiliate", "name email phoneNumber")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
      qrCodes,
    });
  } catch (error) {
    console.error("Get all QR codes error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get specific QR code
exports.getQRCode = async (req, res) => {
  try {
    const { qrCodeId } = req.params;

    const qrCode = await QRCode.findById(qrCodeId).populate(
      "affiliate",
      "name email phoneNumber"
    );

    if (!qrCode) {
      return res.status(404).json({ message: "QR code not found" });
    }

    // Get statistics for this QR code - handle case where Coupon model might not exist yet
    const claimsCount = await Claim.countDocuments({ qrCode: qrCodeId });

    let couponsCount = 0;
    try {
      // Only try to count coupons if the model exists
      if (mongoose.modelNames().includes("Coupon")) {
        const Coupon = mongoose.model("Coupon");
        couponsCount = await Coupon.countDocuments({ qrCode: qrCodeId });
      }
    } catch (error) {
      console.log("Coupon model not fully set up yet:", error.message);
    }

    // Get claims for this QR code
    const claims = await Claim.find({ qrCode: qrCodeId });

    // Get claim IDs
    const claimIds = claims.map((claim) => claim._id);

    // Get purchases for these claims
    const purchases = await Purchase.find({ claim: { $in: claimIds } });

    // Calculate total commission
    const totalCommission = purchases.reduce(
      (sum, purchase) => sum + purchase.commissionAmount,
      0
    );

    res.json({
      qrCode,
      statistics: {
        couponsGenerated: couponsCount,
        claimsCreated: claimsCount,
        purchasesCompleted: purchases.length,
        totalCommission,
      },
    });
  } catch (error) {
    console.error("Get QR code error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update QR code status
exports.updateQRCodeStatus = async (req, res) => {
  try {
    const { qrCodeId } = req.params;
    const { isActive } = req.body;

    // Validate input
    if (isActive === undefined) {
      return res.status(400).json({ message: "isActive status is required" });
    }

    const qrCode = await QRCode.findById(qrCodeId);

    if (!qrCode) {
      return res.status(404).json({ message: "QR code not found" });
    }

    // Update status only without validation to avoid redirectUrl required error
    await QRCode.updateOne({ _id: qrCodeId }, { $set: { isActive: isActive } });

    // Fetch the updated QR code
    const updatedQrCode = await QRCode.findById(qrCodeId);

    res.json({
      message: `QR code ${isActive ? "activated" : "deactivated"} successfully`,
      qrCode: updatedQrCode,
    });
  } catch (error) {
    console.error("Update QR code status error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete QR code
exports.deleteQRCode = async (req, res) => {
  try {
    const { qrCodeId } = req.params;

    const qrCode = await QRCode.findById(qrCodeId);

    if (!qrCode) {
      return res.status(404).json({ message: "QR code not found" });
    }

    // Check if QR code has any claims or coupons
    const claimsCount = await Claim.countDocuments({ qrCode: qrCodeId });
    const couponsCount = await Coupon.countDocuments({ qrCode: qrCodeId });

    if (claimsCount > 0 || couponsCount > 0) {
      return res.status(400).json({
        message:
          "Cannot delete QR code with existing claims or coupons. Deactivate QR code instead.",
      });
    }

    await qrCode.remove();

    res.json({ message: "QR code deleted successfully" });
  } catch (error) {
    console.error("Delete QR code error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getSystemConfig = async (req, res) => {
  try {
    const config = await SystemConfig.getConfig();

    // Don't send sensitive information like API keys
    const safeConfig = {
      defaultDiscountPercentage: config.defaultDiscountPercentage,
      defaultCommissionPercentage: config.defaultCommissionPercentage,
      couponExpiryHours: config.couponExpiryHours,
      frontendBaseUrl: config.frontendBaseUrl,
      whatsappEnabled: config.whatsappEnabled,
      updatedAt: config.updatedAt,
    };

    res.json(safeConfig);
  } catch (error) {
    console.error("Get system config error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update system configuration
exports.updateSystemConfig = async (req, res) => {
  try {
    const {
      defaultDiscountPercentage,
      defaultCommissionPercentage,
      couponExpiryHours,
      frontendBaseUrl,
      whatsappEnabled,
      whatsappApiKey,
    } = req.body;

    let config = await SystemConfig.getConfig();

    // Update fields if provided
    if (defaultDiscountPercentage !== undefined) {
      config.defaultDiscountPercentage = defaultDiscountPercentage;
    }

    if (defaultCommissionPercentage !== undefined) {
      config.defaultCommissionPercentage = defaultCommissionPercentage;
    }

    if (couponExpiryHours !== undefined) {
      config.couponExpiryHours = couponExpiryHours;
    }

    if (frontendBaseUrl !== undefined) {
      config.frontendBaseUrl = frontendBaseUrl;
    }

    if (whatsappEnabled !== undefined) {
      config.whatsappEnabled = whatsappEnabled;
    }

    if (whatsappApiKey !== undefined) {
      config.whatsappApiKey = whatsappApiKey;
    }

    // Set updatedBy and updatedAt
    config.updatedBy = req.admin.id;
    config.updatedAt = new Date();

    await config.save();

    // Return safe config without API keys
    const safeConfig = {
      defaultDiscountPercentage: config.defaultDiscountPercentage,
      defaultCommissionPercentage: config.defaultCommissionPercentage,
      couponExpiryHours: config.couponExpiryHours,
      frontendBaseUrl: config.frontendBaseUrl,
      whatsappEnabled: config.whatsappEnabled,
      updatedAt: config.updatedAt,
    };

    res.json({
      message: "System configuration updated successfully",
      config: safeConfig,
    });
  } catch (error) {
    console.error("Update system config error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get system statistics
// Fix the getSystemStats function to handle missing Coupon model
exports.getSystemStats = async (req, res) => {
  try {
    // Get counts
    const adminCount = await Admin.countDocuments();
    const affiliateCount = await Affiliate.countDocuments();
    const qrCodeCount = await QRCode.countDocuments();
    const claimCount = await Claim.countDocuments();
    const purchaseCount = await Purchase.countDocuments();

    // Initialize coupon counts
    let couponCount = 0;
    let activeCouponCount = 0;

    // Check if Coupon model exists and is available
    if (mongoose.modelNames().includes("Coupon")) {
      const Coupon = mongoose.model("Coupon");
      couponCount = await Coupon.countDocuments();

      // Get active coupons
      activeCouponCount = await Coupon.countDocuments({
        status: { $in: ["generated", "verified"] },
        expiresAt: { $gt: new Date() },
      });
    }

    // Get financial data
    const purchases = await Purchase.find();
    const totalSales = purchases.reduce(
      (sum, purchase) => sum + purchase.finalAmount,
      0
    );
    const totalCommissions = purchases.reduce(
      (sum, purchase) => sum + purchase.commissionAmount,
      0
    );

    // Get today's activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todayCoupons = 0;
    if (mongoose.modelNames().includes("Coupon")) {
      const Coupon = mongoose.model("Coupon");
      todayCoupons = await Coupon.countDocuments({
        createdAt: { $gte: today },
      });
    }

    const todayClaims = await Claim.countDocuments({
      claimedAt: { $gte: today },
    });
    const todayPurchases = await Purchase.countDocuments({
      purchasedAt: { $gte: today },
    });

    const todayPurchaseData = await Purchase.find({
      purchasedAt: { $gte: today },
    });
    const todaySales = todayPurchaseData.reduce(
      (sum, purchase) => sum + purchase.finalAmount,
      0
    );
    const todayCommissions = todayPurchaseData.reduce(
      (sum, purchase) => sum + purchase.commissionAmount,
      0
    );

    res.json({
      counts: {
        admins: adminCount,
        affiliates: affiliateCount,
        qrCodes: qrCodeCount,
        coupons: couponCount,
        claims: claimCount,
        purchases: purchaseCount,
        activeCoupons: activeCouponCount,
      },
      financials: {
        totalSales,
        totalCommissions,
        averageSale: purchaseCount > 0 ? totalSales / purchaseCount : 0,
        averageCommission:
          purchaseCount > 0 ? totalCommissions / purchaseCount : 0,
      },
      today: {
        couponsGenerated: todayCoupons,
        claimsCreated: todayClaims,
        purchasesCompleted: todayPurchases,
        sales: todaySales,
        commissions: todayCommissions,
      },
    });
  } catch (error) {
    console.error("Get system stats error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// backend/controllers/adminController.js - Fix the getPendingWithdrawals function

exports.getPendingWithdrawals = async (req, res) => {
  try {
    // Get all pending withdrawal requests with affiliate details
    // Only populate fields that actually exist in your schema
    const withdrawals = await CommissionWithdrawal.find({ status: "pending" })
      .populate("affiliate", "name email phoneNumber status")
      .populate("processedBy", "name email")
      .sort({ requestDate: -1 });

    // Transform the data and calculate balances for each affiliate
    const flattenedWithdrawals = await Promise.all(
      withdrawals.map(async (withdrawal) => {
        const affiliate = withdrawal.affiliate;

        // Skip if affiliate is null (might happen if affiliate was deleted)
        if (!affiliate) {
          return null;
        }

        // Get all QR codes for this affiliate
        const qrCodes = await QRCode.find({ affiliate: affiliate._id });
        const qrCodeIds = qrCodes.map((qr) => qr._id);

        // Get all claims associated with these QR codes
        const claims = await Claim.find({ qrCode: { $in: qrCodeIds } });
        const claimIds = claims.map((claim) => claim._id);

        // Get all purchases associated with these claims
        const purchases = await Purchase.find({ claim: { $in: claimIds } });

        // Calculate total commission earned
        const totalCommission = purchases.reduce(
          (sum, purchase) => sum + purchase.commissionAmount,
          0
        );

        // Get all approved withdrawals (excluding current pending one)
        const approvedWithdrawals = await CommissionWithdrawal.find({
          affiliate: affiliate._id,
          status: { $in: ["approved", "paid"] },
        });

        // Calculate total withdrawn amount
        const totalWithdrawn = approvedWithdrawals.reduce(
          (sum, w) => sum + w.amount,
          0
        );

        // Calculate available balance
        const availableBalance = totalCommission - totalWithdrawn;

        return {
          // Withdrawal details
          _id: withdrawal._id,
          amount: withdrawal.amount,
          status: withdrawal.status,
          requestDate: withdrawal.requestDate,
          notes: withdrawal.notes,
          upiId: withdrawal.upiId, // Use the actual field from your schema

          // Affiliate details
          affiliateId: affiliate._id,
          affiliateName: affiliate.name,
          affiliateEmail: affiliate.email,
          affiliatePhoneNumber: affiliate.phoneNumber,
          affiliateStatus: affiliate.status,

          // Balance information
          totalCommission,
          totalWithdrawn,
          availableBalance,

          // Add processed info if available
          processedBy: withdrawal.processedBy,
          processedDate: withdrawal.processedDate,
        };
      })
    );

    // Filter out any null entries (from deleted affiliates)
    const validWithdrawals = flattenedWithdrawals.filter((w) => w !== null);

    res.json({
      data: validWithdrawals,
      count: validWithdrawals.length,
      status: 200,
    });
  } catch (error) {
    console.error("Get pending withdrawals error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      status: 500,
    });
  }
};

// Get withdrawal by ID
exports.getWithdrawalById = async (req, res) => {
  try {
    const { withdrawalId } = req.params;

    // Find withdrawal with affiliate details
    const withdrawal = await CommissionWithdrawal.findById(withdrawalId)
      .populate("affiliate", "name email phoneNumber status")
      .populate("processedBy", "name email");

    if (!withdrawal) {
      return res.status(404).json({
        message: "Withdrawal request not found",
        status: 404,
      });
    }

    // Get affiliate's available balance
    const affiliate = withdrawal.affiliate;

    // Get all QR codes for this affiliate
    const qrCodes = await QRCode.find({ affiliate: affiliate._id });
    const qrCodeIds = qrCodes.map((qr) => qr._id);

    // Get all claims associated with these QR codes
    const claims = await Claim.find({ qrCode: { $in: qrCodeIds } });
    const claimIds = claims.map((claim) => claim._id);

    // Get all purchases associated with these claims
    const purchases = await Purchase.find({ claim: { $in: claimIds } });

    // Calculate total commission earned
    const totalCommission = purchases.reduce(
      (sum, purchase) => sum + purchase.commissionAmount,
      0
    );

    // Get all approved withdrawals
    const withdrawals = await CommissionWithdrawal.find({
      affiliate: affiliate._id,
      status: { $in: ["approved", "paid"] },
    });

    // Calculate total withdrawn amount
    const totalWithdrawn = withdrawals.reduce(
      (sum, withdrawal) => sum + withdrawal.amount,
      0
    );

    // Calculate available balance
    const availableBalance = totalCommission - totalWithdrawn;

    res.json({
      data: {
        withdrawal,
        affiliateBalance: {
          totalCommission,
          totalWithdrawn,
          availableBalance,
        },
      },
      status: 200,
    });
  } catch (error) {
    console.error("Get withdrawal by ID error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      status: 500,
    });
  }
};

// In adminController.js - Simplified processWithdrawal function
exports.processWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { status, notes } = req.body;

    // Validate input - simplified status options
    if (!status || !["approved", "rejected", "failed"].includes(status)) {
      return res.status(400).json({
        message: 'Status must be "approved", "rejected", or "failed"',
        status: 400,
      });
    }

    // Find the withdrawal request
    const withdrawal = await CommissionWithdrawal.findById(
      withdrawalId
    ).populate("affiliate");

    if (!withdrawal) {
      return res.status(404).json({
        message: "Withdrawal request not found",
        status: 404,
      });
    }

    // Check if the request is in a valid state for processing
    if (withdrawal.status !== "pending") {
      return res.status(400).json({
        message: "Cannot process a non-pending withdrawal request",
        status: 400,
      });
    }

    // Update withdrawal request
    withdrawal.status = status;
    withdrawal.notes = notes || withdrawal.notes;
    withdrawal.processedDate = new Date();
    withdrawal.processedBy = req.user.id;

    // Add screenshot path if file was uploaded
    if (req.file) {
      withdrawal.paymentScreenshot = `/uploads/${req.file.filename}`;
    }

    await withdrawal.save();

    res.json({
      message: `Withdrawal request ${status} successfully`,
      data: {
        withdrawalId: withdrawal._id,
        amount: withdrawal.amount,
        status: withdrawal.status,
        processedDate: withdrawal.processedDate,
        upiId: withdrawal.upiId,
        paymentScreenshot: withdrawal.paymentScreenshot,
      },
      status: 200,
    });
  } catch (error) {
    console.error("Process withdrawal error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      status: 500,
    });
  }
};

// Get all withdrawal requests with filters
// In adminController.js - Update getAllWithdrawals
exports.getAllWithdrawals = async (req, res) => {
  try {
    const {
      status,
      affiliateId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      sortBy = "requestDate",
      sortDir = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    // Create filter
    const filter = {};

    // Add status filter if provided
    if (
      status &&
      ["pending", "approved", "rejected", "paid"].includes(status)
    ) {
      filter.status = status;
    }

    // Add affiliate filter if provided
    if (affiliateId) {
      filter.affiliate = affiliateId;
    }

    // Add date filter if provided
    if (startDate || endDate) {
      filter.requestDate = {};

      if (startDate) {
        filter.requestDate.$gte = new Date(startDate);
      }

      if (endDate) {
        // Set to end of day
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        filter.requestDate.$lte = endDateTime;
      }
    }

    // Add amount filter if provided
    if (minAmount || maxAmount) {
      filter.amount = {};

      if (minAmount) {
        filter.amount.$gte = parseFloat(minAmount);
      }

      if (maxAmount) {
        filter.amount.$lte = parseFloat(maxAmount);
      }
    }

    // Set up sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortDir === "asc" ? 1 : -1;

    // Get total count for pagination
    const totalCount = await CommissionWithdrawal.countDocuments(filter);
    const withdrawals = await CommissionWithdrawal.find(filter)
      .populate("affiliate", "name email phoneNumber")
      .populate("processedBy", "name email")
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    // Get withdrawals with pagination
    const withdrawalsWithBalance = await Promise.all(
      withdrawals.map(async (withdrawal) => {
        if (!withdrawal.affiliate) {
          return withdrawal.toObject();
        }

        // Get all QR codes for this affiliate
        const qrCodes = await QRCode.find({
          affiliate: withdrawal.affiliate._id,
        });
        const qrCodeIds = qrCodes.map((qr) => qr._id);

        // Get all claims associated with these QR codes
        const claims = await Claim.find({ qrCode: { $in: qrCodeIds } });
        const claimIds = claims.map((claim) => claim._id);

        // Get all purchases associated with these claims
        const purchases = await Purchase.find({ claim: { $in: claimIds } });

        // Calculate total commission earned
        const totalCommission = purchases.reduce(
          (sum, purchase) => sum + purchase.commissionAmount,
          0
        );

        // Get all approved/paid withdrawals for this affiliate
        const approvedWithdrawals = await CommissionWithdrawal.find({
          affiliate: withdrawal.affiliate._id,
          status: { $in: ["approved", "paid"] },
        });

        // Calculate total withdrawn amount
        const totalWithdrawn = approvedWithdrawals.reduce(
          (sum, w) => sum + w.amount,
          0
        );

        // Calculate available balance
        const availableBalance = totalCommission - totalWithdrawn;

        // Return withdrawal with balance info
        const withdrawalObj = withdrawal.toObject();
        withdrawalObj.commissionDetails = {
          totalCommission,
          totalWithdrawn,
          availableBalance,
        };

        return withdrawalObj;
      })
    );

    res.json({
      data: withdrawalsWithBalance,
      pagination: {
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit)),
        page: parseInt(page),
        limit: parseInt(limit),
      },
      status: 200,
    });
  } catch (error) {
    console.error("Get all withdrawals error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      status: 500,
    });
  }
};

// Get withdrawal statistics
exports.getWithdrawalStats = async (req, res) => {
  try {
    // Get counts by status
    const pendingCount = await CommissionWithdrawal.countDocuments({
      status: "pending",
    });
    const approvedCount = await CommissionWithdrawal.countDocuments({
      status: "approved",
    });
    const rejectedCount = await CommissionWithdrawal.countDocuments({
      status: "rejected",
    });
    const paidCount = await CommissionWithdrawal.countDocuments({
      status: "paid",
    });

    // Get total amounts by status
    const pendingAmount = await CommissionWithdrawal.aggregate([
      { $match: { status: "pending" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const approvedAmount = await CommissionWithdrawal.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const paidAmount = await CommissionWithdrawal.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Get recent withdrawals
    const recentWithdrawals = await CommissionWithdrawal.find()
      .populate("affiliate", "name email phoneNumber")
      .sort({ requestDate: -1 })
      .limit(5);

    res.json({
      data: {
        counts: {
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
          paid: paidCount,
          total: pendingCount + approvedCount + rejectedCount + paidCount,
        },
        amounts: {
          pending: pendingAmount.length > 0 ? pendingAmount[0].total : 0,
          approved: approvedAmount.length > 0 ? approvedAmount[0].total : 0,
          paid: paidAmount.length > 0 ? paidAmount[0].total : 0,
          total:
            (pendingAmount.length > 0 ? pendingAmount[0].total : 0) +
            (approvedAmount.length > 0 ? approvedAmount[0].total : 0) +
            (paidAmount.length > 0 ? paidAmount[0].total : 0),
        },
        recentWithdrawals,
      },
      status: 200,
    });
  } catch (error) {
    console.error("Get withdrawal stats error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      status: 500,
    });
  }
};

exports.updateGlobalSettings = async (req, res) => {
  try {
    const { globalDiscountPercentage, globalDiscountMessage } = req.body;

    // Get system config
    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig({});
    }

    // Update fields if provided
    if (globalDiscountPercentage !== undefined) {
      config.globalDiscountPercentage = globalDiscountPercentage;

      // Update message to match percentage if no custom message provided
      if (!globalDiscountMessage) {
        config.globalDiscountMessage = `Scan this QR code for a special ${globalDiscountPercentage}% discount!`;
      }
    }

    if (globalDiscountMessage) {
      config.globalDiscountMessage = globalDiscountMessage;
    }

    await config.save();

    res.json({
      message: "Global settings updated successfully",
      data: {
        globalDiscountPercentage: config.globalDiscountPercentage,
        globalDiscountMessage: config.globalDiscountMessage,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getAllCustomers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      affiliateId,
      search,
      startDate,
      endDate,
      sortBy = "claimedAt",
      sortDir = "desc",
    } = req.query;

    // Build filter
    const filter = {};

    // Filter by affiliate
    if (affiliateId) {
      const qrCodes = await QRCode.find({ affiliate: affiliateId });
      const qrCodeIds = qrCodes.map((qr) => qr._id);
      filter.qrCode = { $in: qrCodeIds };
    }

    // Search by name or phone number
    if (search) {
      filter.$or = [
        { customerName: { $regex: search, $options: "i" } },
        { customerPhone: { $regex: search, $options: "i" } },
      ];
    }

    // Date filter
    if (startDate || endDate) {
      filter.claimedAt = {};

      if (startDate) {
        filter.claimedAt.$gte = new Date(startDate);
      }

      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        filter.claimedAt.$lte = endDateTime;
      }
    }

    // Set up sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortDir === "asc" ? 1 : -1;

    // Count total for pagination
    const totalCount = await Claim.countDocuments(filter);

    // Get claims with pagination
    const claims = await Claim.find(filter)
      .populate({
        path: "qrCode",
        populate: {
          path: "affiliate",
        },
      })
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    // Map claims to customer data with purchase details
    const customerData = await Promise.all(
      claims.map(async (claim) => {
        // Find purchases for this claim
        const purchases = await Purchase.find({ claim: claim._id });

        // Calculate total spent
        const totalSpent = purchases.reduce((sum, p) => sum + p.finalAmount, 0);

        return {
          id: claim._id,
          customerName: claim.customerName,
          customerPhone: claim.customerPhone,
          claimedAt: claim.claimedAt,
          affiliate: claim.qrCode.affiliate
            ? {
                id: claim.qrCode.affiliate._id,
                name: claim.qrCode.affiliate.name,
                email: claim.qrCode.affiliate.email,
                phoneNumber: claim.qrCode.affiliate.phoneNumber,
              }
            : null,
          qrCode: {
            id: claim.qrCode._id,
            discountPercentage: claim.qrCode.discountPercentage,
            commissionPercentage: claim.qrCode.commissionPercentage,
          },
          purchases: purchases.map((p) => ({
            id: p._id,
            originalAmount: p.originalAmount,
            discountAmount: p.discountAmount,
            finalAmount: p.finalAmount,
            commissionAmount: p.commissionAmount,
            purchasedAt: p.purchasedAt,
          })),
          purchasesCount: purchases.length,
          totalSpent,
          status: claim.status,
        };
      })
    );

    res.json({
      data: customerData,
      pagination: {
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit)),
        page: parseInt(page),
        limit: parseInt(limit),
      },
      status: 200,
    });
  } catch (error) {
    console.error("Get all customers error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      status: 500,
    });
  }
};

// In adminController.js - Add function to get pending affiliates
exports.getPendingAffiliates = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    // Count total pending affiliates
    const totalCount = await Affiliate.countDocuments({ status: 'inactive' });
    
    // Get pending affiliates with pagination
    const pendingAffiliates = await Affiliate.find({ status: 'inactive' })
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    
    res.json({
      data: pendingAffiliates,
      count: pendingAffiliates.length,
      pagination: {
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit)),
        page: parseInt(page),
        limit: parseInt(limit)
      },
      status: 200
    });
  } catch (error) {
    console.error('Get pending affiliates error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      status: 500
    });
  }
};

