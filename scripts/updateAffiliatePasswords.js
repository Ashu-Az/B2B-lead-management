// backend/scripts/updateAffiliatePasswords.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Affiliate = require('../models/Affiliate');

async function updateAffiliatePasswords() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Find affiliates without passwords
    const affiliates = await Affiliate.find({ password: { $exists: false } });
    
    if (affiliates.length === 0) {
      console.log('No affiliates without passwords found');
      return;
    }
    
    console.log(`Found ${affiliates.length} affiliates without passwords`);
    
    // Default password
    const defaultPassword = 'affiliate123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(defaultPassword, salt);
    
    // Update each affiliate
    for (const affiliate of affiliates) {
      affiliate.password = hashedPassword;
      await affiliate.save({ validateBeforeSave: false });
      console.log(`Updated password for affiliate: ${affiliate.name} (${affiliate.email})`);
    }
    
    console.log('All affiliates updated successfully');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

updateAffiliatePasswords();