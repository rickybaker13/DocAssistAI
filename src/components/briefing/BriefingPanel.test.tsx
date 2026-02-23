import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BriefingPanel } from './BriefingPanel';
import * as signalServiceModule from '../../services/signal/signalService';
import * as fhirClientServiceModule from '../../services/fhir/fhirClientService';
import { usePatientStore } from '../../stores/patientStore';

// Fix 5: Use vi.fn() in mock factory so functions are already spies when the module loads
vi.mock('../../services/signal/signalService', () => ({
  signalService: {
    process: vi.fn(),
  },
}));
vi.mock('../../services/fhir/fhirClientService', () => ({
  fhirClientService: {
    getICUPatientData: vi.fn(),
  },
}));

// Fix 6: Mock usePatientStore so it can be overridden per-test
vi.mock('../../stores/patientStore');

const mockSignal = {
  headline: 'Patient hemodynamically unstable — norepinephrine at 0.15 mcg/kg/min and titrating',
  domains: [
    { name: 'hemodynamics', findings: ['MAP 58 mmHg', 'HR 112 bpm'], trend: 'worsening' },
    { name: 'respiratory', findings: ['FiO2 60%', 'PEEP 10'], trend: 'stable' },
  ],
  pending: ['Blood culture x48h', 'CT chest read pending'],
  stable: ['Renal function at baseline', 'GI tolerating feeds'],
  generatedAt: new Date().toISOString(),
  timeWindowHours: 24,
};

const mockPatientData = {
  patient: { id: 'patient-123', resourceType: 'Patient' },
  conditions: [], medications: [], medicationAdmins: [], labs: [], vitals: [],
  encounters: [], allergies: [], diagnosticReports: [], procedures: [],
  notes: [], deviceMetrics: [], fetchedAt: new Date().toISOString(),
};

describe('BriefingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Fix 5: Use vi.mocked() instead of unsafe `as any` assignment
    vi.mocked(fhirClientServiceModule.fhirClientService.getICUPatientData).mockResolvedValue(mockPatientData);
    vi.mocked(signalServiceModule.signalService.process).mockResolvedValue(mockSignal);
    // Fix 6: Default mock returns a patient so existing tests keep working
    vi.mocked(usePatientStore).mockReturnValue({ patientSummary: { patient: { id: 'patient-123', resourceType: 'Patient' } } } as any);
  });

  it('shows loading spinner while fetching', async () => {
    render(<BriefingPanel />);
    expect(screen.getByText(/analyzing patient data/i)).toBeInTheDocument();
  });

  it('renders headline after loading', async () => {
    render(<BriefingPanel />);
    await waitFor(() => {
      expect(screen.getByText(/hemodynamically unstable/i)).toBeInTheDocument();
    });
  });

  it('renders domain cards', async () => {
    render(<BriefingPanel />);
    await waitFor(() => {
      expect(screen.getByText(/hemodynamics/i)).toBeInTheDocument();
      expect(screen.getByText(/respiratory/i)).toBeInTheDocument();
    });
  });

  it('renders pending items section', async () => {
    render(<BriefingPanel />);
    await waitFor(() => {
      expect(screen.getAllByText(/pending/i).length).toBeGreaterThan(0);
    });
  });

  it('time window buttons change the selected hours', async () => {
    // Fix 5: Use vi.mocked() instead of `as any`
    const processMock = vi.mocked(signalServiceModule.signalService.process);
    processMock.mockResolvedValue(mockSignal);
    render(<BriefingPanel />);
    await waitFor(() => {
      expect(screen.getByText(/hemodynamically unstable/i)).toBeInTheDocument();
    });
    const btn12h = screen.getByRole('button', { name: /12h/i });
    fireEvent.click(btn12h);
    await waitFor(() => {
      expect(processMock).toHaveBeenCalledTimes(2);
    });
  });

  // Fix 6: New test — no patient placeholder
  it('shows no-patient placeholder when patient is not loaded', () => {
    vi.mocked(usePatientStore).mockReturnValue({ patientSummary: null } as any);
    render(<BriefingPanel />);
    expect(screen.getByText(/no patient loaded/i)).toBeInTheDocument();
  });

  // Fix 6: New test — error message when signal fetch fails
  it('shows error message when signal fetch fails', async () => {
    vi.mocked(fhirClientServiceModule.fhirClientService.getICUPatientData).mockRejectedValue(new Error('Network error'));
    render(<BriefingPanel />);
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  // Fix 6: New test — retry button visible in error state
  it('shows retry button in error state', async () => {
    vi.mocked(fhirClientServiceModule.fhirClientService.getICUPatientData).mockRejectedValue(new Error('Timeout'));
    render(<BriefingPanel />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });
});
