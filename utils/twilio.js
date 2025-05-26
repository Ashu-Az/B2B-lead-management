// backend/utils/twilio.js - Improved for direct sending
const twilio = require('twilio');
require('dotenv').config();

// Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER;

// Initialize Twilio client
let client = null;
try {
  if (accountSid && authToken) {
    client = twilio(accountSid, authToken);
    console.log('Twilio client initialized successfully');
  } else {
    console.warn('Missing Twilio credentials in environment variables!');
  }
} catch (error) {
  console.error('Error initializing Twilio client:', error);
}

/**
 * Send WhatsApp message using Twilio
 * @param {string} phoneNumber - Recipient's phone number (without country code)
 * @param {string} name - Customer's name
 * @param {number} discountPercentage - Discount percentage
 * @param {Date} expiryDate - Expiry date for the coupon
 * @returns {Promise} - Promise resolving to message details
 */
const sendCouponWhatsApp = async (phoneNumber, name, discountPercentage, expiryDate) => {
  // Format phone number with India country code
  const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;
  
  // Format expiry date nicely
  const formattedDate = expiryDate.toDateString();
  
  // Create message
  const message = `Hello ${name},\n\nYour unique coupon code is ${phoneNumber}. You can avail ${discountPercentage}% discount on your visit.\n\nHurry up! This offer expires on ${formattedDate}.\n\nThank you for shopping at Elevate!`;

  console.log(`Sending WhatsApp message to: ${formattedNumber}`);
  console.log(`Message content: ${message}`);

  // If Twilio client isn't initialized, log message instead
  if (!client) {
    console.log(`[MOCK WHATSAPP] To: ${formattedNumber}, Message: ${message}`);
    return { status: 'mocked', to: formattedNumber, message };
  }

  try {
    // Send message via Twilio WhatsApp
    const result = await client.messages.create({
      body: message,
      from: `whatsapp:${twilioNumber}`,
      to: `whatsapp:${formattedNumber}`
    });

    console.log(`WhatsApp message sent with SID: ${result.sid}`);
    return result;
  } catch (error) {
    console.error('Twilio WhatsApp message error:', error);
    return { status: 'error', error: error.message };
  }
};

module.exports = { sendCouponWhatsApp };