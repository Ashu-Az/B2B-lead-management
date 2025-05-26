// backend/app.js - Main server file
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const qrcode = require('qrcode');
const helmet = require('helmet');
const dotenv = require('dotenv');

// Import routes
const adminRoutes = require('./routes/admin');
const affiliateRoutes = require('./routes/affiliate');
const customerRoutes = require('./routes/customer');
const authRoutes = require('./routes/auth');
const serviceRoutes = require('./routes/service');
const serviceQRCodeRoutes = require('./routes/serviceQRCode');
const fs = require('fs');
const path = require('path');

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow all origins during development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'x-auth-token']
}));

app.options('*', cors());

app.use(helmet({
  contentSecurityPolicy: false // Disable CSP during development
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/test', (req, res) => {
  console.log('Test route accessed');
  res.json({ message: 'API is working' });
});
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/affiliate', affiliateRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/service-qrcodes', serviceQRCodeRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;