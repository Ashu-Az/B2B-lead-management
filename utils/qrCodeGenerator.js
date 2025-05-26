// backend/utils/qrCodeGenerator.js
const qrcode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

/**
 * Generate QR code data and image URL
 * 
 * @param {string} affiliateId - Affiliate ID
 * @param {number} discountPercentage - Discount percentage
 * @param {number} commissionPercentage - Commission percentage
 * @returns {Object} - QR code data and image URL
 */
exports.generateQRCode = async (affiliateId, discountPercentage, commissionPercentage) => {
  // Generate unique ID for QR code
  const uniqueId = uuidv4();
  
  // Create QR code data object
  const qrData = {
    affiliateId,
    discountPercentage,
    commissionPercentage,
    uniqueId
  };
  
  // Convert to JSON string
  const qrDataString = JSON.stringify(qrData);
  
  // Generate QR code image as data URL
  const qrCodeImage = await qrcode.toDataURL(qrDataString);
  
  return {
    qrCodeData: qrDataString,
    qrCodeImage
  };
};

