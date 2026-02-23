/**
 * Population Query Engine
 *
 * ARCHITECTURE (for v1.0 implementation):
 *
 * 1. NLQ Translator: natural language → FHIRPath/FHIR search parameters (via LLM)
 * 2. Bulk Exporter: FHIR $export API → async ndjson download → parse
 * 3. Cohort Builder: filter patients by criteria (diagnosis, date range, unit, etc.)
 * 4. Stats Engine: count, rate per 1000 patient-days, trend analysis, chi-square
 * 5. Report Generator: format by role (quality dashboard, compliance report, research table)
 *
 * FHIR Resources needed:
 * - Patient (demographics, identifiers)
 * - Condition (diagnoses — HAI identification)
 * - Observation (labs — culture results for MRSA/CLABSI)
 * - Encounter (admission/discharge dates, unit, length of stay)
 * - Procedure (line placements — CLABSI denominator)
 * - DiagnosticReport (microbiology reports)
 *
 * QUERY SCOPE ISOLATION:
 * - Patient-level queries: per-patient FHIR REST API (already built in SignalEngine)
 * - Population queries: FHIR Bulk API ($export) — requires server-level OAuth (backend-to-EHR)
 * - These are architecturally separate; only the FhirNormalizer is shared
 *
 * USER ROLES:
 * - 'quality': Quality/Safety Officers — bundle compliance, outcome metrics
 * - 'research': Clinical Researchers — cohort queries, statistical analysis
 * - 'admin': Administration/Compliance — regulatory reporting, accreditation
 */

export type PopulationQueryRole = 'quality' | 'research' | 'admin';

export interface PopulationQuery {
  naturalLanguageQuery: string;
  role: PopulationQueryRole;
  dateRange?: { start: string; end: string };
  unit?: string; // e.g., 'ICU', 'MICU', 'SICU'
}

export interface PopulationQueryResult {
  query: string;
  role: PopulationQueryRole;
  results: unknown; // typed in v1.0
  generatedAt: string;
}

export class PopulationQueryEngine {
  /**
   * Execute a natural language population query.
   * @param query - The population query parameters
   * @returns Structured population-level results
   * @throws Error - Not yet implemented (v1.0 roadmap)
   */
  async query(_query: PopulationQuery): Promise<PopulationQueryResult> {
    throw new Error('Not implemented — see v1.0 roadmap');
  }

  /**
   * Get available query templates by role.
   * In v1.0, this will return pre-built query templates for common use cases.
   */
  async getQueryTemplates(_role: PopulationQueryRole): Promise<string[]> {
    throw new Error('Not implemented — see v1.0 roadmap');
  }
}

export const populationQueryEngine = new PopulationQueryEngine();
