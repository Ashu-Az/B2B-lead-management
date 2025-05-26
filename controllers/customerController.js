// backend/controllers/customerController.js
const QRCode = require('../models/QRCode');
const Coupon = require('../models/Coupon');
const Claim = require('../models/Claim');
const Affiliate = require('../models/Affiliate'); 
const Admin = require('../models/Admin');
const twilio = require('twilio');
const { sendCouponWhatsApp } = require('../utils/twilio');
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const SystemConfig=('../models/SystemConfig')
const mongoose = require('mongoose'); 
const querystring = require('querystring'); 
const ServiceQRCode = require('../models/ServiceQRCode');


console.log("TWILIO_ACCOUNT_SID:", process.env.TWILIO_ACCOUNT_SID ? "Set" : "Not set");
console.log("TWILIO_AUTH_TOKEN:", process.env.TWILIO_AUTH_TOKEN ? "Set" : "Not set");
console.log("TWILIO_WHATSAPP_NUMBER:", process.env.TWILIO_WHATSAPP_NUMBER);


let whatsappClient = null;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    whatsappClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log("✅ Twilio client initialized successfully");
  } else {
    console.warn("❌ Missing Twilio credentials");
  }
} catch (error) {
  console.error("❌ Twilio initialization error:", error);
}

// Get QR code details from unique ID
exports.getQRCodeDetails = async (req, res) => {
  try {
    const { qrData } = req.body;
    
    // Parse QR code data
    let parsedData;
    try {
      parsedData = JSON.parse(qrData);
    } catch (error) {
      return res.status(400).json({ message: 'Invalid QR code data' });
    }
    
    // Extract unique ID and affiliate ID
    const { uniqueId, affiliateId } = parsedData;
    
    // Find QR code in database
    const qrCode = await QRCode.findOne({ 
      qrCodeData: { $regex: uniqueId },
      affiliate: affiliateId,
      isActive: true
    }).populate('affiliate');
    
    if (!qrCode) {
      return res.status(404).json({ message: 'QR code not found or inactive' });
    }
    
    res.json({
      affiliateName: qrCode.affiliate.name,
      discountPercentage: qrCode.discountPercentage,
      qrCodeId: qrCode._id
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Claim offer
exports.claimOffer = async (req, res) => {
  try {
    const { qrCodeId, customerName, customerPhone } = req.body;
    
    // Find QR code
    const qrCode = await QRCode.findById(qrCodeId);
    
    if (!qrCode) {
      return res.status(404).json({ message: 'QR code not found' });
    }
    
    if (!qrCode.isActive) {
      return res.status(400).json({ message: 'QR code is inactive' });
    }
    
    // Check if customer already claimed this offer
    const existingClaim = await Claim.findOne({
      qrCode: qrCodeId,
      customerPhone,
      status: { $in: ['claimed', 'purchased'] }
    });
    
    if (existingClaim) {
      return res.status(400).json({ message: 'You have already claimed this offer' });
    }
    
    // Create new claim
    const claim = new Claim({
      qrCode: qrCodeId,
      customerName,
      customerPhone,
      status: 'claimed'
    });
    
    await claim.save();
    
    res.status(201).json({
      message: 'Offer claimed successfully',
      claimId: claim._id
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Verify claim
exports.verifyClaim = async (req, res) => {
  try {
    const { claimId, customerPhone } = req.body;
    
    const claim = await Claim.findOne({
      _id: claimId,
      customerPhone,
      status: 'claimed'
    }).populate({
      path: 'qrCode',
      populate: {
        path: 'affiliate'
      }
    });
    
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found or already used' });
    }
    
    res.json({
      claim,
      affiliate: claim.qrCode.affiliate,
      discountPercentage: claim.qrCode.discountPercentage
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.processScannedQR = async (req, res) => {
  try {
    const { qrId, affiliateId } = req.query;
    
    // Find QR code in database
    const qrCode = await QRCode.findOne({ 
      qrCodeData: { $regex: qrId },
      affiliate: affiliateId,
      isActive: true
    }).populate('affiliate');
    
    if (!qrCode) {
      return res.status(404).json({ message: 'QR code not found or inactive' });
    }
    
    // Return QR code details
    res.json({
      qrCodeId: qrCode._id,
      affiliateName: qrCode.affiliate.name,
      discountPercentage: qrCode.discountPercentage
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



exports.processQRCode = async (req, res) => {
  try {
    const { qrCodeId } = req.query;
    
    // If qrCodeId is provided, process normally
    if (qrCodeId) {
      const qrCode = await QRCode.findById(qrCodeId).populate('affiliate');
      
      if (!qrCode) {
        // Fall back to global QR code if specific one not found
        return await processGlobalLead(res);
      }
      
      if (!qrCode.isActive) {
        return res.status(400).json({ message: 'QR code is inactive' });
      }
      
      res.json({
        affiliateName: qrCode.affiliate.name,
        discountPercentage: qrCode.discountPercentage,
        qrCodeId: qrCode._id
      });
    } 
    // No qrCodeId - Handle as organic/global lead
    else {
      return await processGlobalLead(res);
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Helper function to process global leads
async function processGlobalLead(res) {
  try {
    // Find global affiliate (created during setup)
    const globalAffiliate = await Affiliate.findOne({ email: 'global@system.com' });
    
    if (!globalAffiliate) {
      // First time - create global affiliate and QR code
      const globalAffiliate = new Affiliate({
        name: 'Global System',
        phoneNumber: '0000000000',
        email: 'global@system.com',
        address: 'System',
        password: 'globalSystem123', // You should use a secure random password
        status: 'active'
      });
      
      await globalAffiliate.save();
      
      // Get system config for discount
      const config = await SystemConfig.getConfig();
      const globalDiscount = config.globalDiscountPercentage || 5;
      
      // Create global QR code
      const globalQRCode = new QRCode({
        affiliate: globalAffiliate._id,
        discountPercentage: globalDiscount,
        commissionPercentage: 0,
        qrCodeData: JSON.stringify({
          affiliateId: globalAffiliate._id,
          uniqueId: 'global-system-default'
        }),
        qrCodeImage: 'data:image/png;base64,GLOBAL_QR_PLACEHOLDER',
        redirectUrl: config.frontendBaseUrl || 'https://elevate-coupon-landing-page.vercel.app',
        isActive: true
      });
      
      await globalQRCode.save();
      
      return res.json({
        affiliateName: globalAffiliate.name,
        discountPercentage: globalDiscount,
        qrCodeId: globalQRCode._id,
        isGlobal: true,
        message: config.globalDiscountMessage || "Get special discount on your visit!"
      });
    }
    
    // Get existing global QR code
    const globalQRCode = await QRCode.findOne({ 
      affiliate: globalAffiliate._id,
      isActive: true
    });
    
    if (!globalQRCode) {
      return res.status(500).json({ message: 'Global QR code not configured properly' });
    }
    
    return res.json({
      affiliateName: globalAffiliate.name,
      discountPercentage: globalQRCode.discountPercentage,
      qrCodeId: globalQRCode._id,
      isGlobal: true,
      message: "Get special discount on your visit!"
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error processing global lead', error: error.message });
  }
}

exports.generateCoupon = async (req, res) => {
  try {
    const qrCodeId = req.body.qrCodeId || req.body.qrcodeId;
    const { customerName, customerPhone, dealValue = "standard" } = req.body;
    
    // Import the SystemConfig model directly in this function
    const SystemConfig = require('../models/SystemConfig');
    
    // Validate phone number
    if (!customerPhone || customerPhone.length < 10) {
      return res.status(400).json({ 
        message: 'Valid phone number is required',
        status: 400
      });
    }
    
    let qrCode;
    let isGlobalLead = false;
    let discountMessage = "";
    
    if (qrCodeId) {
      console.log("QR Code ID provided:", qrCodeId);
      qrCode = await QRCode.findById(qrCodeId).populate('affiliate');
      
      if (qrCode) {
        // Valid QR code found - NOT a global lead
        isGlobalLead = false;
        discountMessage = `Congratulations! You've been referred for a special ${qrCode.discountPercentage}% discount!`;
        console.log("Valid QR code found - affiliate lead");
      } else {
        // QR code not found, fall back to global
        isGlobalLead = true;
        console.log("QR code ID invalid, using global lead flow");
      }
    } else {
      // No qrCodeId provided, this is a global lead
      isGlobalLead = true;
      console.log("No QR code ID provided, using global lead flow");
    }
    
    // Handle global lead case
    if (isGlobalLead) {
      // Find or create global affiliate
      let globalAffiliate = await Affiliate.findOne({ email: 'global@system.com' });
      
      if (!globalAffiliate) {
        // Create global affiliate
        globalAffiliate = new Affiliate({
          name: 'Global System',
          phoneNumber: '0000000000',
          email: 'global@system.com',
          address: 'System Generated',
          password: 'globalSystem123',
          status: 'active'
        });
        
        await globalAffiliate.save();
        console.log("Created global affiliate");
      }
      
      // Find or create global QR code
      qrCode = await QRCode.findOne({ affiliate: globalAffiliate._id });
      
      if (!qrCode) {
        // Try to get global discount from config
        let globalDiscount = 5;
        try {
          const config = await SystemConfig.findOne();
          if (config && config.globalDiscountPercentage) {
            globalDiscount = config.globalDiscountPercentage;
            discountMessage = config.globalDiscountMessage || `Enjoy ${globalDiscount}% off on your visit!`;
          }
        } catch (configError) {
          console.error("Config error:", configError);
        }
        
        // Create global QR code
        qrCode = new QRCode({
          affiliate: globalAffiliate._id,
          discountPercentage: globalDiscount,
          commissionPercentage: 0,
          qrCodeData: JSON.stringify({
            affiliateId: globalAffiliate._id,
            uniqueId: 'global-system-default'
          }),
          qrCodeImage: 'data:image/png;base64,GLOBAL_QR_PLACEHOLDER',
          redirectUrl: 'https://elevate-coupon-landing-page.vercel.app',
          isActive: true
        });
        
        await qrCode.save();
        console.log("Created global QR code");
      } else {
        // Get message from config if possible
        try {
          const config = await SystemConfig.findOne();
          if (config && config.globalDiscountMessage) {
            discountMessage = config.globalDiscountMessage;
          } else {
            discountMessage = `Enjoy ${qrCode.discountPercentage}% off on your visit!`;
          }
        } catch (configError) {
          console.error("Config error:", configError);
          discountMessage = `Enjoy ${qrCode.discountPercentage}% off on your visit!`;
        }
      }
    }
    
    if (!qrCode) {
      return res.status(500).json({ 
        message: 'Failed to find or create QR code',
        status: 500
      });
    }
    
    if (!qrCode.isActive) {
      return res.status(400).json({ 
        message: 'QR code is inactive',
        status: 400
      });
    }
    
    // Check for existing coupon
    const existingCoupon = await Coupon.findOne({
      qrCode: qrCode._id,
      customerPhone,
      status: { $in: ['generated', 'verified'] }
    });
    
    if (existingCoupon) {
      return res.status(400).json({ 
        message: 'You already have an active coupon for this offer',
        couponCode: existingCoupon.couponCode,
        discountPercentage: qrCode.discountPercentage,
        discountMessage: discountMessage,
        status: 400
      });
    }
    
    // Set dates
    const startDate = new Date();
    const expiryDate = new Date();
    expiryDate.setDate(startDate.getDate() + 10);  // 10 days validity
    
    console.log("Creating coupon with isGlobal =", isGlobalLead);
    
    // Create coupon with proper isGlobal flag
    const coupon = new Coupon({
      qrCode: qrCode._id,
      customerName,
      customerPhone,
      couponCode: customerPhone,
      expiresAt: expiryDate,
      isGlobal: isGlobalLead  // Set this correctly based on lead source
    });
    
    await coupon.save();
    
    // Update related models
    if (qrCode.affiliate) {
      const affiliate = await Affiliate.findById(qrCode.affiliate._id);
      if (affiliate) {
        affiliate.startDate = startDate;
        affiliate.expiryDate = expiryDate;
        affiliate.couponStatus = 'active';
        await affiliate.save();
      }
    }
    
    // Update admin if available
    const admin = await Admin.findOne();
    if (admin) {
      admin.startDate = startDate;
      admin.expiryDate = expiryDate;
      admin.couponStatus = 'active';
      await admin.save();
    }
    
    // Format discount text
    const discountText = `${qrCode.discountPercentage}% discount`;
    
    // Create WhatsApp message
    const message = `Hello ${customerName},\n\nYour unique coupon code is ${customerPhone}. Your deal value is ${dealValue}, You can avail ${discountText} on your visit.\n\nHurry up! This offer expires on ${expiryDate.toDateString()}.\n\nThank you!`;
    
    // Log WhatsApp details for debugging
    console.log("Twilio Number (from):", `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`);
    console.log("Recipient Number (to):", `whatsapp:+91${customerPhone}`);
    console.log("Message content:", message);
    
    // Send WhatsApp message - ACTUAL SENDING CODE
    if (whatsappClient) {
      try {
        const messageResult = await whatsappClient.messages.create({
          body: message,
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to: `whatsapp:+91${customerPhone}`
        });
        
        console.log("✅ WhatsApp message sent successfully with SID:", messageResult.sid);
      } catch (whatsappError) {
        console.error("❌ WhatsApp sending error:", whatsappError);
        // Continue execution - don't fail if WhatsApp fails
      }
    } else {
      console.log("⚠️ Skipping WhatsApp send - client not initialized");
    }
    
    // Load populated data for response
    const populatedCoupon = await Coupon.findById(coupon._id)
      .populate({
        path: 'qrCode',
        populate: {
          path: 'affiliate'
        }
      });
    
    console.log("Final isGlobalLead:", isGlobalLead);
    
    // Return comprehensive response with all necessary information
    res.status(201).json({
      data: populatedCoupon,
      message: 'Coupon generated successfully',
      couponCode: customerPhone,
      discountPercentage: qrCode.discountPercentage,
      discountMessage: discountMessage,
      expiresAt: expiryDate,
      isGlobalLead: isGlobalLead,  // Now correctly set
      status: 200
    });
  } catch (error) {
    console.error("Error generating coupon:", error);
    res.status(500).json({
      message: 'Internal server error',
      error: error.message,
      status: 500
    });
  }
};

// Admin verifies coupon
exports.verifyCoupon = async (req, res) => {
  try {
    const { couponCode, customerPhone } = req.body;
    
    // Since coupon code is the phone number, verify they match
    if (couponCode !== customerPhone) {
      return res.status(400).json({ 
        message: 'Coupon code must match phone number',
        status: 400
      });
    }
    
    // Find coupon
    const coupon = await Coupon.findOne({
      couponCode,
      customerPhone,
      status: 'generated'
    }).populate({
      path: 'qrCode',
      populate: {
        path: 'affiliate'
      }
    });
    
    if (!coupon) {
      return res.status(404).json({ 
        message: 'Invalid coupon or phone number',
        status: 404
      });
    }
    
    // Check if coupon is expired
    if (new Date() > coupon.expiresAt) {
      coupon.status = 'expired';
      await coupon.save();
      return res.status(400).json({ 
        message: 'Coupon has expired',
        status: 400
      });
    }
    
    // Update coupon status
    coupon.status = 'verified';
    await coupon.save();
    
    res.json({
      coupon,
      affiliate: coupon.qrCode.affiliate,
      discountPercentage: coupon.qrCode.discountPercentage,
      status: 200
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      status: 500
    });
  }
};



exports.verifyCoupon = async (req, res) => {
  try {
    const { couponCode, customerPhone } = req.body;
    
    // Since coupon code is the phone number, verify they match
    if (couponCode !== customerPhone) {
      return res.status(400).json({ message: 'Coupon code must match phone number' });
    }
    
    // Find coupon
    const coupon = await Coupon.findOne({
      couponCode,
      customerPhone,
      status: 'generated'
    }).populate({
      path: 'qrCode',
      populate: {
        path: 'affiliate'
      }
    });
    
    if (!coupon) {
      return res.status(404).json({ message: 'Invalid coupon or phone number' });
    }
    
    // Check if coupon is expired
    if (new Date() > coupon.expiresAt) {
      coupon.status = 'expired';
      await coupon.save();
      return res.status(400).json({ message: 'Coupon has expired' });
    }
    
    // Update coupon status
    coupon.status = 'verified';
    await coupon.save();
    
    res.json({
      coupon,
      affiliate: coupon.qrCode.affiliate,
      discountPercentage: coupon.qrCode.discountPercentage
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.createClaim = async (req, res) => {
  try {
    const { couponCode, customerPhone } = req.body;
    
    // Find and verify coupon
    const coupon = await Coupon.findOne({
      couponCode,
      customerPhone,
      status: 'verified'
    });
    
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found or not verified' });
    }
    
    // Create claim
    const claim = new Claim({
      qrCode: coupon.qrCode,
      customerName: coupon.customerName,
      customerPhone: coupon.customerPhone,
      status: 'claimed'
    });
    
    await claim.save();
    
    // Update coupon status
    coupon.status = 'claimed';
    await coupon.save();
    
    res.status(201).json({
      message: 'Claim created successfully',
      claimId: claim._id
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



exports.processServiceQRCode = async (req, res) => {
  console.log("=== QR Code Scan Started ===");
  console.log("Request Query:", req.query);
  console.log("Request IP:", req.ip);
  console.log("User Agent:", req.get('User-Agent'));
  
  try {
    const { qrId } = req.query;
    
    // Default redirect URL if something goes wrong
    const defaultRedirectUrl = 'https://elevate-coupon-landing.vercel.app/';
    
    // If qrId not provided, redirect to coupon landing page
    if (!qrId) {
      console.log("❌ Missing QR ID, redirecting to coupon landing page");
      return res.redirect(defaultRedirectUrl);
    }
    
    console.log("🔍 Looking for QR Code with ID:", qrId);
    
    // Find the service QR code
    let serviceQRCode;
    try {
      serviceQRCode = await ServiceQRCode.findById(qrId)
        .populate({
          path: 'services.service',
          select: 'name serviceType serviceData isActive'
        });
    } catch (err) {
      console.error("❌ Error finding ServiceQRCode:", err);
      return res.redirect(defaultRedirectUrl);
    }
    
    if (!serviceQRCode) {
      console.log("❌ QR code not found");
      return res.redirect(defaultRedirectUrl);
    }
    
    if (!serviceQRCode.isActive) {
      console.log("❌ QR code is inactive");
      return res.redirect(defaultRedirectUrl);
    }
    
    console.log("✅ QR Code found:", serviceQRCode.name);
    console.log("📊 Current scan count:", serviceQRCode.scans || 0);
    
    // Increment scan counter
    try {
      const currentScans = serviceQRCode.scans || 0;
      serviceQRCode.scans = currentScans + 1;
      serviceQRCode.lastScannedAt = new Date();
      
      console.log("💾 Saving scan count update...");
      const updatedQRCode = await serviceQRCode.save();
      console.log("✅ Scan count successfully updated to:", updatedQRCode.scans);
    } catch (updateErr) {
      console.error("❌ Error updating scan count:", updateErr);
      // Continue with redirect even if scan count update fails
    }
    
    // Process services and build URL params
    const servicesList = [];
    let redirectParams = "";
    let activeServiceCount = 0;
    
    console.log("🔧 Processing services...");
    
    serviceQRCode.services.forEach((serviceItem, index) => {
      // Skip if service is not found or inactive
      if (!serviceItem.service || !serviceItem.service.isActive) {
        console.log(`⚠️ Skipping inactive service at index ${index}`);
        return;
      }
      
      const serviceName = serviceItem.service.name;
      const serviceData = serviceItem.service.serviceData;
      
      console.log(`✅ Adding service: ${serviceName} -> ${serviceData}`);
      
      // Add to service list
      servicesList.push({
        name: serviceName,
        serviceType: serviceItem.service.serviceType,
        serviceLink: serviceData,
        displayOrder: serviceItem.displayOrder || 0
      });
      
      // Add to URL params WITHOUT encoding
      redirectParams += `${activeServiceCount === 0 ? '?' : '&'}service_${serviceName}=${serviceData}`;
      activeServiceCount++;
    });
    
    // Sort services by display order
    servicesList.sort((a, b) => a.displayOrder - b.displayOrder);
    
    // If no active services found, redirect to coupon landing page
    if (servicesList.length === 0) {
      console.log("❌ No active services found, redirecting to coupon landing page");
      return res.redirect(defaultRedirectUrl);
    }
    
    console.log(`✅ Found ${servicesList.length} active services`);
    
    // Build base URL with name as path segment
    let baseUrl = serviceQRCode.frontendUrl;
    if (!baseUrl.endsWith('/')) {
      baseUrl += '/';
    }
    baseUrl += serviceQRCode.name;
    
    // Build the final redirect URL
    const redirectUrl = `${baseUrl}${redirectParams}`;
    
    console.log("🎯 Final redirect URL:", redirectUrl);
    console.log("=== Redirecting User ===");
    
    // Use explicit HTTP 302 redirect with headers
    res.writeHead(302, {
      'Location': redirectUrl,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    return res.end();
    
  } catch (error) {
    console.error('❌ Service QR process error:', error);
    // For any errors, redirect to coupon landing page
    res.writeHead(302, {
      'Location': 'https://elevate-coupon-landing.vercel.app/',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    return res.end();
  }
};