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
});
