/**
 * AI API Routes
 * Handles AI-related API endpoints
 */

import { Router, Request, Response } from 'express';
import { aiService } from '../services/ai/aiService.js';
import { ChatRequest, DocumentRequest } from '../types/index.js';

const router = Router();

/**
 * POST /api/ai/chat
 * Chat completion endpoint
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const request: ChatRequest = {
      messages: req.body.messages || [],
      patientContext: req.body.patientContext,
      options: req.body.options,
    };

    // Validate request
    if (!request.messages || request.messages.length === 0) {
      return res.status(400).json({
        error: 'Messages are required',
      });
    }

    // Get context from middleware
    const context = (req as any).phiContext || {};
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    // Process chat request
    const response = await aiService.chat(request, {
      ...context,
      ipAddress,
    });

    res.json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process chat request',
    });
  }
});

/**
 * POST /api/ai/generate-document
 * Document generation endpoint
 */
router.post('/generate-document', async (req: Request, res: Response) => {
  try {
    const request: DocumentRequest = {
      template: req.body.template,
      patientData: req.body.patientData,
      additionalContext: req.body.additionalContext,
    };

    // Validate request
    if (!request.template || !request.patientData) {
      return res.status(400).json({
        error: 'Template and patient data are required',
      });
    }

    // Get context from middleware
    const context = (req as any).phiContext || {};
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    // Generate document
    const content = await aiService.generateDocument(request, {
      ...context,
      ipAddress,
    });

    res.json({
      success: true,
      data: {
        content,
      },
    });
  } catch (error: any) {
    console.error('Document generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate document',
    });
  }
});

/**
 * GET /api/ai/health
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const { getAIProvider } = await import('../services/ai/providerFactory.js');
    const provider = getAIProvider();
    const isAvailable = await provider.isAvailable();

    res.json({
      success: true,
      data: {
        provider: provider.getName(),
        available: isAvailable,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Health check failed',
    });
  }
});

export default router;

