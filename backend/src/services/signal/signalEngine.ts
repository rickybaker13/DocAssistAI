import { FhirNormalizer, ClinicalTimeline } from './fhirNormalizer.js';
import { SignalExtractor, PatientSignal } from './signalExtractor.js';
import { contextStore } from './contextStore.js';

export class SignalEngine {
  private normalizer = new FhirNormalizer();
  private extractor = new SignalExtractor();

  normalize(data: any): ClinicalTimeline {
    return this.normalizer.normalize(data);
  }

  async extractSignal(
    timeline: ClinicalTimeline,
    opts: { hoursBack: number; patientId: string }
  ): Promise<PatientSignal> {
    return this.extractor.extract(timeline, opts.hoursBack);
  }

  async process(sessionId: string, patientData: any, hoursBack = 24): Promise<PatientSignal> {
    const cached = contextStore.getSignal(sessionId, hoursBack);
    if (cached) return cached;

    const timeline = this.normalizer.normalize(patientData);
    contextStore.set(sessionId, patientData.patient?.id || '', timeline);

    const signal = await this.extractSignal(timeline, { hoursBack, patientId: patientData.patient?.id || '' });
    contextStore.setSignal(sessionId, hoursBack, signal);

    return signal;
  }
}

export const signalEngine = new SignalEngine();
