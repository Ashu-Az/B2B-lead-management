// backend/scripts/verify-twilio.js
require('dotenv').config();
const twilio = require('twilio');

// Display environment variables
console.log('Environment Variables:');
console.log('--------------------------');
console.log('TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? '✅ Set' : '❌ Not set');
console.log('TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? '✅ Set' : '❌ Not set');
console.log('TWILIO_WHATSAPP_NUMBER:', process.env.TWILIO_WHATSAPP_NUMBER || '❌ Not set');

// Check if variables are set
if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_WHATSAPP_NUMBER) {
  console.error('\n❌ Error: Required Twilio environment variables are missing!');
  console.log('Please make sure the following variables are set in your .env file:');
  console.log('  TWILIO_ACCOUNT_SID=your_account_sid');
  console.log('  TWILIO_AUTH_TOKEN=your_auth_token');
  console.log('  TWILIO_WHATSAPP_NUMBER=your_twilio_number');
  process.exit(1);
}

// Initialize Twilio client
console.log('\nAttempting to connect to Twilio...');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Verify connection
async function verifyConnection() {
  try {
    // Fetch account details to verify credentials
    const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    console.log('\n✅ Successfully connected to Twilio!');
    console.log('Account Status:', account.status);
    console.log('Account Type:', account.type);
    console.log('Account Created:', new Date(account.dateCreated).toLocaleString());
    
    // Test if WhatsApp is set up
    console.log('\nWhatsApp Information:');
    console.log('WhatsApp Number:', process.env.TWILIO_WHATSAPP_NUMBER);
    console.log('Note: WhatsApp Sandbox requires users to opt-in by sending');
    console.log(`"join <sandbox-code>" to ${process.env.TWILIO_WHATSAPP_NUMBER}`);
    
    // Get information about your Twilio number
    try {
      const phoneNumber = await client.incomingPhoneNumbers.list({phoneNumber: process.env.TWILIO_WHATSAPP_NUMBER});
      if (phoneNumber && phoneNumber.length > 0) {
        console.log('\nPhone Number Verification:');
        console.log('Number found in your Twilio account ✅');
      } else {
        console.log('\n⚠️ Warning: The TWILIO_WHATSAPP_NUMBER is not found in your Twilio account');
        console.log('Please check if the number is correctly formatted with country code.');
      }
    } catch (err) {
      console.log('\n⚠️ Warning: Unable to verify if number belongs to your account');
    }
    
    console.log('\n✅ Twilio verification complete!');
    
  } catch (error) {
    console.error('\n❌ Failed to connect to Twilio:');
    console.error('Error:', error.message);
    console.error('\nPossible solutions:');
    console.error('1. Check if your Account SID and Auth Token are correct');
    console.error('2. Verify your Twilio account is active and not suspended');
    console.error('3. Check your internet connection');
    process.exit(1);
  }
}

verifyConnection();