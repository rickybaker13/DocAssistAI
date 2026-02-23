/**
 * Transcription API Route
 * Handles audio upload and Whisper transcription via POST /api/ai/transcribe
 */

import { Router, Request, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import { WhisperService } from '../services/transcription/whisperService.js';
import { logAIServiceUsage } from '../services/audit/auditLogger.js';

const router = Router();
const whisperService = new WhisperService();

// Allowed audio MIME types
const ALLOWED_MIME_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/wav',
  'audio/wave',
  'audio/mpeg',
  'audio/ogg',
]);

// Multer configuration: memory storage, 25MB limit, MIME type allowlist
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    }
  },
});

/**
 * POST /api/ai/transcribe
 * Accepts a multipart form upload with field name 'audio'.
 * Returns { transcript: string } on success or { error: string } on failure.
 */
router.post('/transcribe', (req: Request, res: Response, next: NextFunction) => {
  upload.single('audio')(req, res, (err) => {
    if (err instanceof MulterError) {
      const context = (req as any).phiContext || {};
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

      logAIServiceUsage(
        context.userId,
        context.patientId,
        'whisper',
        '/api/ai/transcribe',
        ipAddress,
        false,
        err.message
      );

      return res.status(400).json({ error: err.message });
    }

    if (err) {
      return next(err);
    }

    return next();
  });
}, async (req: Request, res: Response) => {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcription failed';

    console.error('[transcribe] Transcription error:', error);

    logAIServiceUsage(
      context.userId,
      context.patientId,
      'whisper',
      '/api/ai/transcribe',
      ipAddress,
      false,
      message
    );

    if (message === 'Empty audio buffer') {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({ error: 'Transcription failed' });
  }
});

export default router;
