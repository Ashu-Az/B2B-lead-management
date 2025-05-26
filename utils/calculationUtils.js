// backend/utils/calculationUtils.js
/**
 * Calculate discount and commission amounts
 * 
 * @param {number} originalAmount - Original shopping amount
 * @param {number} discountPercentage - Discount percentage
 * @param {number} commissionPercentage - Commission percentage
 * @returns {Object} - Calculated amounts
 */
exports.calculateAmounts = (originalAmount, discountPercentage, commissionPercentage) => {
    // Calculate discount amount
    const discountAmount = (originalAmount * discountPercentage) / 100;
    
    // Calculate final amount after discount
    const finalAmount = originalAmount - discountAmount;
    
    // Calculate commission amount based on the final amount
    const commissionAmount = (finalAmount * commissionPercentage) / 100;
    
    return {
      originalAmount,
      discountPercentage,
      discountAmount,
      finalAmount,
      commissionPercentage,
      commissionAmount
    };
  };
  
  