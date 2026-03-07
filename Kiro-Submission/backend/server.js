/**
 * AI "Touch-to-Explain" Learning Assistant — Backend Server
 * 
 * Express.js server that simulates the AWS serverless backend
 * (API Gateway + Lambda Orchestrator + DynamoDB + S3 + Polly + Textract)
 * for demo purposes. All services are mocked with in-memory storage.
 * 
 * Endpoints:
 *   POST /api/v1/explain          — Generate AI explanation for highlighted text
 *   POST /api/v1/audio            — Convert explanation to speech (mock Polly)
 *   GET  /api/v1/audio/voices     — List available TTS voices
 *   GET  /api/v1/flashcards       — Get user's flashcards
 *   GET  /api/v1/learning-summary — Get learning analytics
 *   POST /api/v1/documents        — Upload a document
 *   GET  /api/v1/documents        — List user's documents
 *   GET  /api/v1/health           — Health check
 */

const { config, validateConfig } = require('./config');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Middleware
const { authMiddleware, dataIsolation } = require('./middleware/auth');
const { rateLimiter } = require('./middleware/rateLimiter');

// Routes
const explainRoutes = require('./routes/explain');
const audioRoutes = require('./routes/audio');
const flashcardRoutes = require('./routes/flashcards');
const learningSummaryRoutes = require('./routes/learningSummary');
const documentRoutes = require('./routes/documents');

// Store (for health check / monitoring)
const store = require('./store/dynamoStore');
const { circuitBreakers } = require('./middleware/circuitBreaker');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Global Middleware ──
app.use(cors({
  origin: '*',  // Allow all origins for Chrome Extension
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware (Req 12)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const latency = Date.now() - start;
    if (req.path !== '/api/v1/health') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${res.statusCode} (${latency}ms)`);
    }
  });
  next();
});

// ── Public Routes (no auth) ──

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AI Touch-to-Explain Learning Assistant',
    version: '1.0.0-demo',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    circuitBreakers: {
      llm: circuitBreakers.llm.getStatus(),
      ocr: circuitBreakers.ocr.getStatus(),
      voice: circuitBreakers.voice.getStatus(),
      storage: circuitBreakers.storage.getStatus(),
    },
  });
});

// ── Protected Routes (auth required) ──

// Apply auth + rate limiting to all /api/v1/* routes below
app.use('/api/v1/explain', authMiddleware, dataIsolation, rateLimiter, explainRoutes);
app.use('/api/v1/audio', authMiddleware, rateLimiter, audioRoutes);
app.use('/api/v1/flashcards', authMiddleware, dataIsolation, rateLimiter, flashcardRoutes);
app.use('/api/v1/learning-summary', authMiddleware, dataIsolation, rateLimiter, learningSummaryRoutes);
app.use('/api/v1/documents', authMiddleware, dataIsolation, rateLimiter, documentRoutes);

// ── Monitoring endpoint ──
app.get('/api/v1/monitoring/logs', authMiddleware, (req, res) => {
  res.json({
    logs: store.getRequestLogs(),
    total: store.getRequestLogs().length,
  });
});

// ── 404 handler ──
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Endpoint ${req.method} ${req.path} does not exist.`,
  });
});

// ── Global error handler (Req 14.1) ──
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred. Please try again later.',
  });
});

// ── Start Server ──
app.listen(PORT, () => {
  // Display config validation warnings
  const warnings = validateConfig();

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   AI "Touch-to-Explain" Learning Assistant — Backend    ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║   Server running at: http://localhost:${PORT}              ║`);
  console.log('║   Demo token:        demo-user-token                    ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║   Service Configuration:                               ║');
  console.log(`║     Mode:      ${(config.mode).padEnd(40)}║`);
  console.log(`║     LLM:       ${(config.llm.provider).padEnd(40)}║`);
  console.log(`║     Voice:     ${(config.polly.enabled ? 'AWS Polly' : 'Mock').padEnd(40)}║`);
  console.log(`║     OCR:       ${(config.textract.enabled ? 'AWS Textract' : 'Mock').padEnd(40)}║`);
  console.log(`║     Storage:   ${(config.dynamodb.enabled ? 'DynamoDB' : 'In-Memory').padEnd(40)}║`);
  console.log(`║     Region:    ${(config.aws.region).padEnd(40)}║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║   Endpoints:                                           ║');
  console.log('║     POST /api/v1/explain          Explain text          ║');
  console.log('║     POST /api/v1/audio            Text to speech        ║');
  console.log('║     GET  /api/v1/flashcards       Get flashcards        ║');
  console.log('║     GET  /api/v1/learning-summary Learning analytics    ║');
  console.log('║     POST /api/v1/documents        Upload document       ║');
  console.log('║     GET  /api/v1/health           Health check          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  if (warnings.length > 0) {
    console.log('');
    console.log('⚠  Configuration warnings:');
    warnings.forEach(w => console.log(`   - ${w}`));
  }
  console.log('');
});

module.exports = app;
