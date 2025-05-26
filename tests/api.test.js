// // backend/tests/api.test.js
// const request = require('supertest');
// const mongoose = require('mongoose');
// const app = require('../app');
// const Admin = require('../models/Admin');
// const Affiliate = require('../models/Affiliate');
// const QRCode = require('../models/QRCode');
// const Claim = require('../models/Claim');
// const Purchase = require('../models/Purchase');

// // Test data
// const adminData = {
//   username: 'testadmin',
//   password: 'password123',
//   email: 'admin@test.com',
//   name: 'Test Admin'
// };

// const affiliateData = {
//   name: 'Test Affiliate',
//   phoneNumber: '1234567890',
//   email: 'affiliate@test.com',
//   address: '123 Test St'
// };

// const qrCodeData = {
//   discountPercentage: 15,
//   commissionPercentage: 7.5
// };

// const customerData = {
//   customerName: 'Test Customer',
//   customerPhone: '9876543210'
// };

// const purchaseData = {
//   originalAmount: 200.00
// };

// // Test variables
// let adminToken;
// let affiliateId;
// let qrCodeId;
// let qrRawData;
// let claimId;

// // Connect to test database before tests
// beforeAll(async () => {
//   try {
//     await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/qrcode-test', {
//       useNewUrlParser: true,
//       useUnifiedTopology: true
//     });
//     console.log('Connected to test database');
    
//     // Clear all collections
//     await Admin.deleteMany({});
//     await Affiliate.deleteMany({});
//     await QRCode.deleteMany({});
//     await Claim.deleteMany({});
//     await Purchase.deleteMany({});
//   } catch (error) {
//     console.error('Database connection error:', error);
//   }
// });

// // Disconnect from test database after tests
// afterAll(async () => {
//   await mongoose.connection.close();
// });

// //================ ADMIN TESTS ================//

// describe('Admin Authentication Tests', () => {
//   test('Should register a new admin', async () => {
//     const res = await request(app)
//       .post('/api/admin/register')
//       .send(adminData);
    
//     expect(res.statusCode).toBe(201);
//     expect(res.body.message).toBe('Admin created successfully');
    
//     // Verify admin was created in database
//     const admin = await Admin.findOne({ username: adminData.username });
//     expect(admin).toBeTruthy();
//     expect(admin.email).toBe(adminData.email);
//   });
  
//   test('Should not register admin with duplicate username', async () => {
//     const res = await request(app)
//       .post('/api/admin/register')
//       .send(adminData);
    
//     expect(res.statusCode).toBe(400);
//     expect(res.body.message).toBe('Admin already exists');
//   });
  
//   test('Should login successfully with valid credentials', async () => {
//     const res = await request(app)
//       .post('/api/admin/login')
//       .send({
//         username: adminData.username,
//         password: adminData.password
//       });
    
//     expect(res.statusCode).toBe(200);
//     expect(res.body.token).toBeTruthy();
//     expect(res.body.admin.username).toBe(adminData.username);
    
//     // Save token for future tests
//     adminToken = res.body.token;
//   });
  
//   test('Should not login with invalid credentials', async () => {
//     const res = await request(app)
//       .post('/api/admin/login')
//       .send({
//         username: adminData.username,
//         password: 'wrongpassword'
//       });
    
//     expect(res.statusCode).toBe(401);
//     expect(res.body.message).toBe('Invalid credentials');
//   });
// });

// describe('Affiliate Management Tests', () => {
//   test('Should not create affiliate without authentication', async () => {
//     const res = await request(app)
//       .post('/api/admin/affiliate')
//       .send(affiliateData);
    
//     expect(res.statusCode).toBe(401);
//     expect(res.body.message).toBe('No token, authorization denied');
//   });
  
//   test('Should create a new affiliate', async () => {
//     const res = await request(app)
//       .post('/api/admin/affiliate')
//       .set('x-auth-token', adminToken)
//       .send(affiliateData);
    
//     expect(res.statusCode).toBe(201);
//     expect(res.body.message).toBe('Affiliate created successfully');
//     expect(res.body.affiliate.name).toBe(affiliateData.name);
//     expect(res.body.affiliate.email).toBe(affiliateData.email);
    
//     // Save affiliate ID for future tests
//     affiliateId = res.body.affiliate._id;
    
//     // Verify affiliate was created in database
//     const affiliate = await Affiliate.findById(affiliateId);
//     expect(affiliate).toBeTruthy();
//     expect(affiliate.phoneNumber).toBe(affiliateData.phoneNumber);
//   });
  
//   test('Should get all affiliates', async () => {
//     const res = await request(app)
//       .get('/api/admin/affiliates')
//       .set('x-auth-token', adminToken);
    
//     expect(res.statusCode).toBe(200);
//     expect(Array.isArray(res.body)).toBeTruthy();
//     expect(res.body.length).toBeGreaterThan(0);
    
//     // Verify the created affiliate is in the list
//     const foundAffiliate = res.body.find(a => a._id === affiliateId);
//     expect(foundAffiliate).toBeTruthy();
//     expect(foundAffiliate.name).toBe(affiliateData.name);
//   });
// });

// describe('QR Code Generation Tests', () => {
//   test('Should generate QR code for affiliate', async () => {
//     const res = await request(app)
//       .post('/api/admin/qrcode')
//       .set('x-auth-token', adminToken)
//       .send({
//         affiliateId,
//         discountPercentage: qrCodeData.discountPercentage,
//         commissionPercentage: qrCodeData.commissionPercentage
//       });
    
//     expect(res.statusCode).toBe(201);
//     expect(res.body.message).toBe('QR code generated successfully');
//     expect(res.body.qrCode.affiliate).toBe(affiliateId);
//     expect(res.body.qrCode.discountPercentage).toBe(qrCodeData.discountPercentage);
//     expect(res.body.qrCode.commissionPercentage).toBe(qrCodeData.commissionPercentage);
//     expect(res.body.qrCode.qrCodeImage).toContain('data:image/png;base64');
    
//     // Save QR code ID for future tests
//     qrCodeId = res.body.qrCode._id;
//     qrRawData = res.body.qrCode.qrCodeData;
    
//     // Verify QR code was created in database
//     const qrCode = await QRCode.findById(qrCodeId);
//     expect(qrCode).toBeTruthy();
//     expect(qrCode.isActive).toBe(true);
//   });
  
//   test('Should not generate QR code for non-existent affiliate', async () => {
//     const res = await request(app)
//       .post('/api/admin/qrcode')
//       .set('x-auth-token', adminToken)
//       .send({
//         affiliateId: '60f1a5c5f2e5c62d8c1a5c5f', // Non-existent ID
//         discountPercentage: qrCodeData.discountPercentage,
//         commissionPercentage: qrCodeData.commissionPercentage
//       });
    
//     expect(res.statusCode).toBe(404);
//     expect(res.body.message).toBe('Affiliate not found');
//   });
  
//   test('Should get QR codes for specific affiliate', async () => {
//     const res = await request(app)
//       .get(`/api/admin/qrcodes/${affiliateId}`)
//       .set('x-auth-token', adminToken);
    
//     expect(res.statusCode).toBe(200);
//     expect(Array.isArray(res.body)).toBeTruthy();
//     expect(res.body.length).toBeGreaterThan(0);
    
//     // Verify the created QR code is in the list
//     const foundQRCode = res.body.find(qr => qr._id === qrCodeId);
//     expect(foundQRCode).toBeTruthy();
//     expect(foundQRCode.discountPercentage).toBe(qrCodeData.discountPercentage);
//   });
// });

// //================ CUSTOMER TESTS ================//

// describe('Customer QR Code Interaction Tests', () => {
//   test('Should retrieve QR code details', async () => {
//     const res = await request(app)
//       .post('/api/customer/qrcode')
//       .send({ qrData: qrRawData });
    
//     expect(res.statusCode).toBe(200);
//     expect(res.body.affiliateName).toBe(affiliateData.name);
//     expect(res.body.discountPercentage).toBe(qrCodeData.discountPercentage);
//     expect(res.body.qrCodeId).toBe(qrCodeId);
//   });
  
//   test('Should claim offer with valid QR code', async () => {
//     const res = await request(app)
//       .post('/api/customer/claim')
//       .send({
//         qrCodeId,
//         customerName: customerData.customerName,
//         customerPhone: customerData.customerPhone
//       });
    
//     expect(res.statusCode).toBe(201);
//     expect(res.body.message).toBe('Offer claimed successfully');
//     expect(res.body.claimId).toBeTruthy();
    
//     // Save claim ID for future tests
//     claimId = res.body.claimId;
    
//     // Verify claim was created in database
//     const claim = await Claim.findById(claimId);
//     expect(claim).toBeTruthy();
//     expect(claim.customerName).toBe(customerData.customerName);
//     expect(claim.customerPhone).toBe(customerData.customerPhone);
//     expect(claim.status).toBe('claimed');
//   });
  
//   test('Should not allow duplicate claim from same customer', async () => {
//     const res = await request(app)
//       .post('/api/customer/claim')
//       .send({
//         qrCodeId,
//         customerName: customerData.customerName,
//         customerPhone: customerData.customerPhone
//       });
    
//     expect(res.statusCode).toBe(400);
//     expect(res.body.message).toBe('You have already claimed this offer');
//   });
  
//   test('Should verify valid claim', async () => {
//     const res = await request(app)
//       .post('/api/customer/verify')
//       .send({
//         claimId,
//         customerPhone: customerData.customerPhone
//       });
    
//     expect(res.statusCode).toBe(200);
//     expect(res.body.claim.customerName).toBe(customerData.customerName);
//     expect(res.body.affiliate.name).toBe(affiliateData.name);
//     expect(res.body.discountPercentage).toBe(qrCodeData.discountPercentage);
//   });
  
//   test('Should not verify claim with wrong phone number', async () => {
//     const res = await request(app)
//       .post('/api/customer/verify')
//       .send({
//         claimId,
//         customerPhone: '1111111111' // Wrong phone number
//       });
    
//     expect(res.statusCode).toBe(404);
//     expect(res.body.message).toBe('Claim not found or already used');
//   });
// });

// //================ PURCHASE PROCESSING TESTS ================//

// describe('Purchase Processing Tests', () => {
//   test('Should process purchase with valid claim', async () => {
//     const res = await request(app)
//       .post('/api/admin/purchase')
//       .set('x-auth-token', adminToken)
//       .send({
//         claimId,
//         originalAmount: purchaseData.originalAmount
//       });
    
//     expect(res.statusCode).toBe(201);
//     expect(res.body.message).toBe('Purchase processed successfully');
//     expect(res.body.purchase.claim).toBe(claimId);
//     expect(res.body.purchase.originalAmount).toBe(purchaseData.originalAmount);
    
//     // Calculate expected values
//     const expectedDiscountAmount = purchaseData.originalAmount * (qrCodeData.discountPercentage / 100);
//     const expectedFinalAmount = purchaseData.originalAmount - expectedDiscountAmount;
//     const expectedCommissionAmount = expectedFinalAmount * (qrCodeData.commissionPercentage / 100);
    
//     // Verify purchase calculations
//     expect(res.body.purchase.discountPercentage).toBe(qrCodeData.discountPercentage);
//     expect(res.body.purchase.discountAmount).toBeCloseTo(expectedDiscountAmount, 2);
//     expect(res.body.purchase.finalAmount).toBeCloseTo(expectedFinalAmount, 2);
//     expect(res.body.purchase.commissionPercentage).toBe(qrCodeData.commissionPercentage);
//     expect(res.body.purchase.commissionAmount).toBeCloseTo(expectedCommissionAmount, 2);
    
//     // Verify purchase was created in database
//     const purchase = await Purchase.findById(res.body.purchase._id);
//     expect(purchase).toBeTruthy();
//     expect(purchase.originalAmount).toBe(purchaseData.originalAmount);
    
//     // Verify claim status was updated
//     const updatedClaim = await Claim.findById(claimId);
//     expect(updatedClaim.status).toBe('purchased');
//   });
  
//   test('Should not process purchase with already processed claim', async () => {
//     const res = await request(app)
//       .post('/api/admin/purchase')
//       .set('x-auth-token', adminToken)
//       .send({
//         claimId,
//         originalAmount: purchaseData.originalAmount
//       });
    
//     expect(res.statusCode).toBe(400);
//     expect(res.body.message).toBe('Claim already processed or expired');
//   });
// });

// //================ AFFILIATE DASHBOARD TESTS ================//

// describe('Affiliate Dashboard Tests', () => {
//   test('Should get affiliate details', async () => {
//     const res = await request(app)
//       .get(`/api/affiliate/${affiliateId}`);
    
//     expect(res.statusCode).toBe(200);
//     expect(res.body.name).toBe(affiliateData.name);
//     expect(res.body.email).toBe(affiliateData.email);
//     expect(res.body.phoneNumber).toBe(affiliateData.phoneNumber);
//   });
  
//   test('Should get affiliate QR codes', async () => {
//     const res = await request(app)
//       .get(`/api/affiliate/${affiliateId}/qrcodes`);
    
//     expect(res.statusCode).toBe(200);
//     expect(Array.isArray(res.body)).toBeTruthy();
//     expect(res.body.length).toBeGreaterThan(0);
    
//     // Verify QR code details
//     const qrCode = res.body.find(qr => qr._id === qrCodeId);
//     expect(qrCode).toBeTruthy();
//     expect(qrCode.discountPercentage).toBe(qrCodeData.discountPercentage);
//     expect(qrCode.commissionPercentage).toBe(qrCodeData.commissionPercentage);
//   });
  
//   test('Should get affiliate dashboard data', async () => {
//     const res = await request(app)
//       .get(`/api/affiliate/${affiliateId}/dashboard`);
    
//     expect(res.statusCode).toBe(200);
    
//     // Verify statistics
//     expect(res.body.statistics).toBeTruthy();
//     expect(res.body.statistics.totalQRCodes).toBeGreaterThan(0);
//     expect(res.body.statistics.totalClaims).toBe(1);
//     expect(res.body.statistics.totalPurchases).toBe(1);
//     expect(res.body.statistics.conversionRate).toBeCloseTo(100, 2); // 1 purchase from 1 claim = 100%
    
//     // Check commission calculation
//     const expectedFinalAmount = purchaseData.originalAmount * (1 - qrCodeData.discountPercentage / 100);
//     const expectedCommission = expectedFinalAmount * (qrCodeData.commissionPercentage / 100);
//     expect(res.body.statistics.totalCommission).toBeCloseTo(expectedCommission, 2);
    
//     // Verify recent activity
//     expect(res.body.recentActivity).toBeTruthy();
//     expect(Array.isArray(res.body.recentActivity.claims)).toBeTruthy();
//     expect(Array.isArray(res.body.recentActivity.purchases)).toBeTruthy();
//     expect(res.body.recentActivity.claims.length).toBeGreaterThan(0);
//     expect(res.body.recentActivity.purchases.length).toBeGreaterThan(0);
//   });
// });

// //================ ADMIN DASHBOARD TESTS ================//

// describe('Admin Dashboard Tests', () => {
//   test('Should get admin dashboard data', async () => {
//     const res = await request(app)
//       .get('/api/admin/dashboard')
//       .set('x-auth-token', adminToken);
    
//     expect(res.statusCode).toBe(200);
    
//     // Verify counts
//     expect(res.body.counts.affiliates).toBeGreaterThan(0);
//     expect(res.body.counts.qrCodes).toBeGreaterThan(0);
//     expect(res.body.counts.claims).toBeGreaterThan(0);
//     expect(res.body.counts.purchases).toBeGreaterThan(0);
    
//     // Verify financial data
//     const expectedFinalAmount = purchaseData.originalAmount * (1 - qrCodeData.discountPercentage / 100);
//     const expectedCommission = expectedFinalAmount * (qrCodeData.commissionPercentage / 100);
    
//     expect(res.body.financials.totalSales).toBeCloseTo(expectedFinalAmount, 2);
//     expect(res.body.financials.totalCommissions).toBeCloseTo(expectedCommission, 2);
    
//     // Verify recent purchases
//     expect(Array.isArray(res.body.recentPurchases)).toBeTruthy();
//     expect(res.body.recentPurchases.length).toBeGreaterThan(0);
    
//     // Verify purchase details in recent purchases
//     const purchase = res.body.recentPurchases[0];
//     expect(purchase.originalAmount).toBe(purchaseData.originalAmount);
//     expect(purchase.claim).toBeTruthy();
//   });
// });

// //================ EDGE CASE TESTS ================//

// describe('Edge Case Tests', () => {
//   test('Should handle non-existent affiliate', async () => {
//     const nonExistentId = '60f1a5c5f2e5c62d8c1a5c5f'; // Non-existent ID
//     const res = await request(app)
//       .get(`/api/affiliate/${nonExistentId}`);
    
//     expect(res.statusCode).toBe(404);
//     expect(res.body.message).toBe('Affiliate not found');
//   });
  
//   test('Should handle invalid QR code data', async () => {
//     const res = await request(app)
//       .post('/api/customer/qrcode')
//       .send({ qrData: 'invalid-json-data' });
    
//     expect(res.statusCode).toBe(400);
//     expect(res.body.message).toBe('Invalid QR code data');
//   });
  
//   test('Should handle non-existent claim', async () => {
//     const nonExistentId = '60f1a5c5f2e5c62d8c1a5c5f'; // Non-existent ID
//     const res = await request(app)
//       .post('/api/customer/verify')
//       .send({
//         claimId: nonExistentId,
//         customerPhone: customerData.customerPhone
//       });
    
//     expect(res.statusCode).toBe(404);
//     expect(res.body.message).toBe('Claim not found or already used');
//   });
  
//   test('Should handle invalid JWT token', async () => {
//     const res = await request(app)
//       .get('/api/admin/dashboard')
//       .set('x-auth-token', 'invalid-token');
    
//     expect(res.statusCode).toBe(401);
//     expect(res.body.message).toBe('Token is not valid');
//   });
// });