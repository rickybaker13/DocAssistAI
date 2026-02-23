import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fhirClientService } from './fhirClientService';
import { smartAuthService } from '../auth/smartAuthService';

// Mock smartAuthService so getClient() returns a controllable mock
vi.mock('../auth/smartAuthService', () => ({
  smartAuthService: {
    getClient: vi.fn(),
  },
}));

describe('FhirClientService — ICU extensions', () => {
  const emptyBundle = { entry: [] };

  beforeEach(() => {
    const mockRequest = vi.fn().mockResolvedValue(emptyBundle);
    (smartAuthService.getClient as ReturnType<typeof vi.fn>).mockReturnValue({
      request: mockRequest,
    });
  });

  it('getMedicationAdministrations returns an array', async () => {
    const result = await fhirClientService.getMedicationAdministrations('patient-123');
    expect(Array.isArray(result)).toBe(true);
  });

  it('getDeviceMetrics returns an array', async () => {
    const result = await fhirClientService.getDeviceMetrics('patient-123');
    expect(Array.isArray(result)).toBe(true);
  });

  it('getLabs accepts count and hoursBack parameters', async () => {
    const result = await fhirClientService.getLabs('patient-123', 100, 24);
    expect(Array.isArray(result)).toBe(true);
  });

  it('getVitals accepts count and hoursBack parameters', async () => {
    const result = await fhirClientService.getVitals('patient-123', 200, 48);
    expect(Array.isArray(result)).toBe(true);
  });

  it('getICUPatientData returns object with all required fields', async () => {
    const result = await fhirClientService.getICUPatientData('patient-123');
    expect(result).toHaveProperty('patient');
    expect(result).toHaveProperty('labs');
    expect(result).toHaveProperty('vitals');
    expect(result).toHaveProperty('medicationAdmins');
    expect(result).toHaveProperty('deviceMetrics');
    expect(result).toHaveProperty('notes');
    expect(result).toHaveProperty('fetchedAt');
  });

  it('getICUPatientData returns partial data (empty arrays) when optional resources fail', async () => {
    // Simulate a FHIR server that rejects MedicationAdministration, DeviceMetric,
    // and DocumentReference queries (e.g. Cerner not supporting those resource types),
    // while returning valid empty bundles for core clinical resources.
    const mockRequest = vi.fn().mockImplementation((url: string) => {
      if (
        url.includes('MedicationAdministration') ||
        url.includes('DeviceMetric') ||
        (url.includes('DocumentReference') && !url.includes('FHIR_QUERIES'))
      ) {
        return Promise.reject(new Error('Resource type not supported by this server'));
      }
      // Core resources and Patient return empty bundles / empty object
      if (url.includes('Patient/')) {
        return Promise.resolve({ resourceType: 'Patient', id: 'patient-123' });
      }
      return Promise.resolve({ entry: [] });
    });

    (smartAuthService.getClient as ReturnType<typeof vi.fn>).mockReturnValue({
      request: mockRequest,
    });

    // Should resolve (not reject) even though optional resources fail
    const result = await fhirClientService.getICUPatientData('patient-123');

    // Optional resources that failed must come back as empty arrays
    expect(Array.isArray(result.medicationAdmins)).toBe(true);
    expect(result.medicationAdmins).toHaveLength(0);

    expect(Array.isArray(result.deviceMetrics)).toBe(true);
    expect(result.deviceMetrics).toHaveLength(0);

    expect(Array.isArray(result.notes)).toBe(true);
    expect(result.notes).toHaveLength(0);

    // Core resources must still be present
    expect(result).toHaveProperty('patient');
    expect(Array.isArray(result.labs)).toBe(true);
    expect(Array.isArray(result.vitals)).toBe(true);
    expect(result).toHaveProperty('fetchedAt');
  });
});
