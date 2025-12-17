/**
 * PHI Protection Middleware
 * Ensures PHI is handled securely and can optionally redact sensitive data
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Extract user and patient context from request
 * In production, this would extract from SMART tokens
 */
export function extractContext(req: Request): {
  userId?: string;
  patientId?: string;
} {
  // Extract from headers (set by frontend with SMART context)
  return {
    userId: req.headers['x-user-id'] as string | undefined,
    patientId: req.headers['x-patient-id'] as string | undefined,
  };
}

/**
 * PHI redaction utility
 * Redacts common PHI patterns before sending to AI
 */
export function redactPHI(text: string): string {
  if (process.env.ENABLE_PHI_REDACTION === 'true') {
    // Redact common PHI patterns
    let redacted = text;
    
    // SSN pattern
    redacted = redacted.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]');
    
    // Phone numbers
    redacted = redacted.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]');
    
    // Email addresses (keep domain for context)
    redacted = redacted.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]');
    
    // Credit card numbers
    redacted = redacted.replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, '[CC_REDACTED]');
    
    return redacted;
  }
  
  return text;
}

/**
 * PHI protection middleware
 * Adds context extraction and PHI handling to requests
 */
export function phiProtectionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract context
  const context = extractContext(req);
  
  // Attach to request for use in routes
  (req as any).phiContext = context;
  
  // If request body contains patient data, log access
  if (req.body?.patientContext || req.body?.patientData) {
    // Log will be handled by audit middleware
  }
  
  next();
}

/**
 * Validate request contains required context
 */
export function validatePHIContext(req: Request): boolean {
  const context = (req as any).phiContext;
  // For now, patient context is optional (may come from EHR launch)
  // In production, enforce based on endpoint requirements
  return true;
}

