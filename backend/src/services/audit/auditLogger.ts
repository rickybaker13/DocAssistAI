/**
 * HIPAA-Compliant Audit Logger
 * Logs all access to PHI and system actions for compliance
 */

import winston from 'winston';
import path from 'path';
import { AuditLog } from '../../types/index.js';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = process.env.AUDIT_LOG_PATH 
  ? path.dirname(process.env.AUDIT_LOG_PATH)
  : './logs';

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const auditLogPath = process.env.AUDIT_LOG_PATH || path.join(logsDir, 'audit.log');

/**
 * Create audit logger
 */
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: auditLogPath,
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    }),
  ],
});

/**
 * Log audit event
 */
export function logAuditEvent(log: AuditLog): void {
  if (process.env.ENABLE_AUDIT_LOGGING !== 'false') {
    auditLogger.info('AUDIT', {
      timestamp: log.timestamp.toISOString(),
      userId: log.userId || 'unknown',
      patientId: log.patientId || 'unknown',
      action: log.action,
      endpoint: log.endpoint,
      ipAddress: log.ipAddress,
      success: log.success,
      error: log.error,
      metadata: log.metadata,
    });
  }
}

/**
 * Log PHI access
 */
export function logPHIAccess(
  userId: string | undefined,
  patientId: string | undefined,
  action: string,
  endpoint: string,
  ipAddress?: string,
  success: boolean = true,
  error?: string
): void {
  logAuditEvent({
    timestamp: new Date(),
    userId,
    patientId,
    action: `PHI_ACCESS:${action}`,
    endpoint,
    ipAddress,
    success,
    error,
  });
}

/**
 * Log AI service usage
 */
export function logAIServiceUsage(
  userId: string | undefined,
  patientId: string | undefined,
  provider: string,
  endpoint: string,
  ipAddress?: string,
  success: boolean = true,
  error?: string,
  metadata?: Record<string, any>
): void {
  logAuditEvent({
    timestamp: new Date(),
    userId,
    patientId,
    action: `AI_SERVICE:${provider}`,
    endpoint,
    ipAddress,
    success,
    error,
    metadata: {
      ...metadata,
      provider,
    },
  });
}

/**
 * Log authentication events
 */
export function logAuthEvent(
  userId: string | undefined,
  action: string,
  endpoint: string,
  ipAddress?: string,
  success: boolean = true,
  error?: string
): void {
  logAuditEvent({
    timestamp: new Date(),
    userId,
    action: `AUTH:${action}`,
    endpoint,
    ipAddress,
    success,
    error,
  });
}

