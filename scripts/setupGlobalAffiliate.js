// Add to scripts/setupGlobalAffiliate.js
const Affiliate = require('../models/Affiliate');
const Admin = require('../models/Admin');
const QRCode = require('../models/QRCode');
const SystemConfig = require('../models/SystemConfig');

async function createGlobalAffiliate() {
  try {
    // Check if global affiliate already exists
    let globalAffiliate = await Affiliate.findOne({ email: 'global@system.com' });
    
    if (!globalAffiliate) {
      // Create global affiliate
      globalAffiliate = new Affiliate({
        name: 'Global System',
        phoneNumber: '0000000000',
        email: 'global@system.com',
        address: 'System Generated',
        password: 'globalSystem123',
        status: 'active',
        role: 'system'
      });
      
      await globalAffiliate.save();
      console.log('Global affiliate created');
      
      // Create global QR code with system config discount
      const config = await SystemConfig.getConfig();
      
      const qrCode = new QRCode({
        affiliate: globalAffiliate._id,
        discountPercentage: config.defaultDiscountPercentage || 10,
        commissionPercentage: 0,
        qrCodeData: JSON.stringify({
          affiliateId: globalAffiliate._id,
          uniqueId: 'global-system-default',
          isGlobal: true
        }),
        qrCodeImage: 'data:image/png;base64,GLOBAL_QR_CODE_IMAGE',
        redirectUrl: config.frontendBaseUrl || 'http://localhost:3001',
        isActive: true
      });
      
      await qrCode.save();
      console.log('Global QR code created');
    }
    
    return globalAffiliate;
  } catch (error) {
    console.error('Error creating global affiliate:', error);
  }
}