// backend/utils/responseFormatter.js
/**
 * Format API response
 * 
 * @param {boolean} success - Success status
 * @param {string} message - Response message
 * @param {any} data - Response data
 * @returns {Object} - Formatted response
 */
exports.formatResponse = (success, message, data = null) => {
    return {
      success,
      message,
      data
    };
  };
  
  