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
  constructor() {
    // Sweep expired entries every 15 minutes to prevent unbounded memory growth
    // and ensure PHI is not retained in process memory beyond TTL
    setInterval(() => {
      const now = Date.now();
      for (const [key, ctx] of cache.entries()) {
        if (now - new Date(ctx.cachedAt).getTime() > CACHE_TTL_MS) {
          cache.delete(key);
        }
      }
    }, CACHE_TTL_MS).unref(); // .unref() so this timer doesn't prevent process exit
  }

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
    } else {
      // Context was evicted during async LLM call — log warning, don't silently discard
      console.warn(`[ContextStore] Session "${sessionId}" was evicted during signal extraction — signal not cached`);
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
