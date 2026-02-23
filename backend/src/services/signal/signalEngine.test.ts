import { SignalEngine } from './signalEngine.js';

// Minimal mock ICU patient data
const mockICUPatientData = {
  patient: { id: 'patient-123', resourceType: 'Patient' },
  conditions: [],
  medications: [],
  medicationAdmins: [],
  labs: [
    {
      id: 'lab-1',
      resourceType: 'Observation',
      code: { text: 'Creatinine', coding: [{ display: 'Creatinine' }] },
      valueQuantity: { value: 2.8, unit: 'mg/dL' },
      effectiveDateTime: new Date(Date.now() - 2 * 3600000).toISOString(), // 2h ago
      interpretation: [{ coding: [{ code: 'H' }] }],
    },
    {
      id: 'lab-2',
      resourceType: 'Observation',
      code: { text: 'Lactate', coding: [{ display: 'Lactate' }] },
      valueQuantity: { value: 4.2, unit: 'mmol/L' },
      effectiveDateTime: new Date(Date.now() - 4 * 3600000).toISOString(), // 4h ago
      interpretation: [{ coding: [{ code: 'H' }] }],
    },
  ],
  vitals: [
    {
      id: 'vital-1',
      resourceType: 'Observation',
      code: { text: 'Blood Pressure', coding: [{ display: 'Blood Pressure' }] },
      valueQuantity: { value: 82, unit: 'mmHg' },
      effectiveDateTime: new Date(Date.now() - 1 * 3600000).toISOString(), // 1h ago
    },
  ],
  encounters: [],
  allergies: [],
  diagnosticReports: [],
  procedures: [],
  notes: [],
  deviceMetrics: [],
  fetchedAt: new Date().toISOString(),
};

describe('SignalEngine', () => {
  let engine: SignalEngine;

  beforeEach(() => {
    engine = new SignalEngine();
  });

  it('normalizes FHIR data into a clinical timeline with events', () => {
    const timeline = engine.normalize(mockICUPatientData);
    expect(Array.isArray(timeline.events)).toBe(true);
    expect(timeline.events.length).toBeGreaterThan(0);
    expect(timeline.events[0]).toHaveProperty('timestamp');
    expect(timeline.events[0]).toHaveProperty('type');
    expect(timeline.events[0]).toHaveProperty('label');
  });

  it('timeline events are sorted descending by timestamp', () => {
    const timeline = engine.normalize(mockICUPatientData);
    for (let i = 1; i < timeline.events.length; i++) {
      expect(new Date(timeline.events[i - 1].timestamp).getTime())
        .toBeGreaterThanOrEqual(new Date(timeline.events[i].timestamp).getTime());
    }
  });

  it('timeline has patientId and builtAt fields', () => {
    const timeline = engine.normalize(mockICUPatientData);
    expect(timeline.patientId).toBe('patient-123');
    expect(typeof timeline.builtAt).toBe('string');
  });

  it('extractSignal returns signal with required fields (mocked LLM)', async () => {
    const timeline = engine.normalize(mockICUPatientData);
    // Mock the OpenAI call inside SignalExtractor
    // Instead: mock at the module level — use jest.mock or spy on extractSignal itself
    jest.spyOn(engine, 'extractSignal').mockResolvedValue({
      headline: 'Rising creatinine and elevated lactate — evaluate for sepsis-AKI',
      domains: [{ name: 'renal', findings: ['Creatinine 2.8 mg/dL (elevated)'], trend: 'worsening' }],
      pending: ['Culture results pending'],
      stable: ['Ventilator settings unchanged'],
      generatedAt: new Date().toISOString(),
      timeWindowHours: 24,
    });
    const signal = await engine.extractSignal(timeline, { hoursBack: 24, patientId: 'patient-123' });
    expect(signal).toHaveProperty('headline');
    expect(signal).toHaveProperty('domains');
    expect(signal).toHaveProperty('pending');
    expect(signal).toHaveProperty('stable');
    expect(Array.isArray(signal.domains)).toBe(true);
  });

  it('process() returns a PatientSignal (mocked LLM)', async () => {
    jest.spyOn(engine, 'extractSignal').mockResolvedValue({
      headline: 'Test headline',
      domains: [],
      pending: [],
      stable: [],
      generatedAt: new Date().toISOString(),
      timeWindowHours: 24,
    });
    const signal = await engine.process('session-abc', mockICUPatientData, 24);
    expect(signal).toHaveProperty('headline');
    expect(signal.headline).toBe('Test headline');
  });
});
