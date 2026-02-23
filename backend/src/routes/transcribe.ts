/**
 * Transcription API Route
 * Handles audio upload and Whisper transcription via POST /api/ai/transcribe
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { WhisperService } from '../services/transcription/whisperService.js';
import { logAIServiceUsage } from '../services/audit/auditLogger.js';

const router = Router();
const whisperService = new WhisperService();

// Multer configuration: memory storage, 25MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});

/**
 * POST /api/ai/transcribe
 * Accepts a multipart form upload with field name 'audio'.
 * Returns { transcript: string } on success or { error: string } on failure.
 */
router.post('/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
  const context = (req as any).phiContext || {};
  const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const transcript = await whisperService.transcribe(req.file.buffer, req.file.mimetype);

    logAIServiceUsage(
      context.userId,
      context.patientId,
      'whisper',
      '/api/ai/transcribe',
      ipAddress,
      true,
      undefined,
      { mimeType: req.file.mimetype, sizeBytes: req.file.size }
    );

    return res.json({ transcript });
  } catch (error: any) {
    logAIServiceUsage(
      context.userId,
      context.patientId,
      'whisper',
      '/api/ai/transcribe',
      ipAddress,
      false,
      error.message
    );

    const status = error.message === 'Empty audio buffer' ? 400 : 500;
    return res.status(status).json({ error: error.message || 'Transcription failed' });
  }
});

export default router;
