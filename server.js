require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const chatRouter = require('./routes/chat');
const { GEMINI_MODEL } = require('./services/gemini');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Payload size limiting
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));

// Health check endpoint (uninhibited for monitoring)
app.get('/api/health', (req, res) => {
  const isKeyConfigured = Boolean(
    process.env.GEMINI_API_KEY &&
    process.env.GEMINI_API_KEY.trim() !== '' &&
    process.env.GEMINI_API_KEY !== 'your_api_key_here'
  );

  res.json({
    status: 'ok',
    service: 'universe.ai',
    model: GEMINI_MODEL,
    hasApiKey: isKeyConfigured,
    timestamp: new Date().toISOString()
  });
});

// Rate limiting specifically on chat interactions to prevent abuse
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 chat messages per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this address. Please wait a moment before trying again.'
  }
});

// Chat routes with rate limiter
app.use('/api', chatLimiter, chatRouter);

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all 404 for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Fallback to index.html for frontend navigation
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[universe.ai Server Error]:', err.message || err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: 'Internal server error occurred.'
  });
});

// Start listening
app.listen(PORT, () => {
  console.log(`🌌 universe.ai is running at http://localhost:${PORT}`);
  console.log(`🤖 Configured Gemini Model: ${GEMINI_MODEL}`);
  if (
    !process.env.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY === 'your_api_key_here'
  ) {
    console.warn('⚠️  Warning: GEMINI_API_KEY is not set or using placeholder in .env');
  } else {
    console.log('🔑 Gemini API Key configured.');
  }
});
