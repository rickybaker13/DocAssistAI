/**
 * Audit Middleware
 * Automatically logs API requests for HIPAA compliance
 */

import { Request, Response, NextFunction } from 'express';
import { logPHIAccess, logAIServiceUsage } from '../services/audit/auditLogger.js';
import { extractContext } from './phiProtection.js';

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const context = extractContext(req);
  const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

  // Override res.json to log response
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;

    // Log based on endpoint
    if (req.path.includes('/ai/')) {
      logAIServiceUsage(
        context.userId,
        context.patientId,
        'unknown', // Provider will be logged by service
        req.path,
        ipAddress,
        success,
        success ? undefined : body.error || 'Unknown error',
        { duration, method: req.method }
      );
    } else if (req.path.includes('/patient/') || context.patientId) {
      logPHIAccess(
        context.userId,
        context.patientId,
        req.method,
        req.path,
        ipAddress,
        success
      );
    }

    return originalJson(body);
  };

  next();
}

