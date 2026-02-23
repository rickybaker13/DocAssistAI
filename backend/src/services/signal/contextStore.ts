import { PatientSignal } from './signalExtractor.js';
import { ClinicalTimeline } from './fhirNormalizer.js';

interface CachedContext {
  timeline: ClinicalTimeline;
  signals: Record<number, PatientSignal>;
  cachedAt: string;
  patientId: string;
}

const cache = new Map<string, CachedContext>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export class ContextStore {
  set(sessionId: string, patientId: string, timeline: ClinicalTimeline): void {
    const existing = cache.get(sessionId);
    cache.set(sessionId, {
      timeline,
      signals: existing?.signals || {},
      cachedAt: new Date().toISOString(),
      patientId,
    });
  }

  setSignal(sessionId: string, hoursBack: number, signal: PatientSignal): void {
    const existing = cache.get(sessionId);
    if (existing) {
      existing.signals[hoursBack] = signal;
    }
  }

  get(sessionId: string): CachedContext | null {
    const ctx = cache.get(sessionId);
    if (!ctx) return null;
    if (Date.now() - new Date(ctx.cachedAt).getTime() > CACHE_TTL_MS) {
      cache.delete(sessionId);
      return null;
    }
    return ctx;
  }

  getSignal(sessionId: string, hoursBack: number): PatientSignal | null {
    return this.get(sessionId)?.signals[hoursBack] ?? null;
  }

  invalidate(sessionId: string): void {
    cache.delete(sessionId);
  }
}

export const contextStore = new ContextStore();
