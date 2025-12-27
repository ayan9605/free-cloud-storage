require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const fileRoutes = require('./routes/files');
const { initBot } = require('./utils/telegram');

const app = express();

// Initialize Database and Bot
connectDB();
initBot();

// Security Middleware
app.use(helmet());
app.use(compression());

// CORS Configuration - FIXED VERSION
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(' ').filter(url => url.length > 0)
  : ['*'];

console.log('🔗 Allowed CORS origins:', allowedOrigins);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all origins if * is in the list
    if (allowedOrigins.includes('*')) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('⚠️  Request from origin:', origin);
      console.log('⚠️  Allowed origins:', allowedOrigins);
      callback(null, true); // TEMPORARILY ALLOW - Remove this line for strict mode
      // callback(new Error('Not allowed by CORS')); // Uncomment for strict mode
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again later.' }
});

app.use('/api/', limiter);

// Routes
app.use('/api/files', fileRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    environment: process.env.NODE_ENV,
    corsOrigins: allowedOrigins
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Backend API running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 CORS enabled for:`, allowedOrigins);
});

module.exports = app;
