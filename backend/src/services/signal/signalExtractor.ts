import OpenAI from 'openai';
import { ClinicalTimeline } from './fhirNormalizer.js';

export interface SignalDomain {
  name: string;
  findings: string[];
  trend?: 'improving' | 'worsening' | 'stable' | 'new';
}

export interface PatientSignal {
  headline: string;
  domains: SignalDomain[];
  pending: string[];
  stable: string[];
  generatedAt: string;
  timeWindowHours: number;
}

export class SignalExtractor {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this.client;
  }

  async extract(timeline: ClinicalTimeline, hoursBack: number): Promise<PatientSignal> {
    const cutoff = new Date(Date.now() - hoursBack * 3600000).toISOString();
    const recentEvents = timeline.events.filter(e => e.timestamp >= cutoff);

    const prompt = this.buildPrompt(recentEvents, hoursBack);

    const response = await this.getClient().chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a critical care physician AI assistant. Analyze patient data and extract clinically significant signal from noise.
Return structured JSON only. Be concise, clinically precise, and prioritize acuity.
Focus on: hemodynamics, respiratory, renal, infectious disease, neurology, lines/tubes/drains.
Flag: abnormal trends, new findings, pending results, clinical deterioration or improvement.
Ignore: routine stable findings, minor fluctuations within normal range.`,
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const content = response.choices[0].message.content || '{}';
    const parsed = JSON.parse(content);

    return {
      headline: parsed.headline || 'No significant acute findings in this time window.',
      domains: parsed.domains || [],
      pending: parsed.pending || [],
      stable: parsed.stable || [],
      generatedAt: new Date().toISOString(),
      timeWindowHours: hoursBack,
    };
  }

  // PRIVACY: source IDs and raw text are intentionally excluded from the LLM prompt to limit PHI exposure.
  private buildPrompt(recentEvents: any[], hoursBack: number): string {
    const summary = recentEvents.slice(0, 150).map(e => {
      // Scrub FHIR resource IDs (source field) and truncate free-text values
      const value = typeof e.value === 'string'
        ? e.value.slice(0, 200)  // truncate free-text (may contain PHI narrative)
        : e.value;
      return `[${e.timestamp}] ${e.type.toUpperCase()} | ${e.label}: ${value ?? ''} ${e.unit ?? ''}${e.isAbnormal ? ' ABNORMAL' : ''}`;
      // Note: source (FHIR resource ID) intentionally omitted from LLM prompt
    }).join('\n');

    return `Analyze this ICU patient data from the last ${hoursBack} hours and extract clinical signal.

DATA:
${summary || '(no data in this time window)'}

Return JSON:
{
  "headline": "single most important clinical finding or action item",
  "domains": [
    { "name": "hemodynamics|respiratory|renal|infectious|neuro|lines_tubes_drains", "findings": ["finding 1"], "trend": "improving|worsening|stable|new" }
  ],
  "pending": ["item 1"],
  "stable": ["item 1"]
}

Only include domains with meaningful findings. One sentence per finding maximum.`;
  }
}
