/**
 * Express Server
 * Main server file for DocAssistAI backend
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { validateAIConfig } from './config/aiConfig.js';
import { phiProtectionMiddleware } from './middleware/phiProtection.js';
import { auditMiddleware } from './middleware/audit.js';
import aiRoutes from './routes/ai.js';
import transcribeRoutes from './routes/transcribe.js';
import discoveryRoutes from './routes/discovery.js';
import signalRouter from './routes/signal.js';
import populationRouter from './routes/population.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration - allow frontend origin
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost origins (dev mode)
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    
    // Allow configured frontend URL
    if (origin === FRONTEND_URL) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Patient-Id', 'X-User-Id', 'X-Session-Id'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// HIPAA compliance middleware
app.use(phiProtectionMiddleware);
app.use(auditMiddleware);

// Validate AI configuration on startup
const configValidation = validateAIConfig();
if (!configValidation.valid) {
  console.error('⚠️  AI Configuration Error:', configValidation.error);
  console.error('Please check your .env file');
}

// Routes
app.use('/api/ai', aiRoutes);
app.use('/api/ai', transcribeRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/signal', signalRouter);
app.use('/api/population', populationRouter);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    aiConfig: configValidation.valid ? 'valid' : 'invalid',
  });
});

// Error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 DocAssistAI Backend Server running on port ${PORT}`);
  console.log(`📡 Frontend URL: ${FRONTEND_URL}`);
  console.log(`🤖 AI Provider: ${process.env.AI_PROVIDER || 'external'}`);
  if (!configValidation.valid) {
    console.warn(`⚠️  Warning: ${configValidation.error}`);
  }
});
