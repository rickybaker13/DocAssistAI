import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BriefingPanel } from './BriefingPanel';
import * as signalServiceModule from '../../services/signal/signalService';
import * as fhirClientServiceModule from '../../services/fhir/fhirClientService';

// Mock modules
vi.mock('../../services/signal/signalService');
vi.mock('../../services/fhir/fhirClientService');
vi.mock('../../stores/patientStore', () => ({
  usePatientStore: () => ({
    patientSummary: { patient: { id: 'patient-123', resourceType: 'Patient' } },
  }),
}));

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
    (fhirClientServiceModule.fhirClientService.getICUPatientData as any) = vi.fn().mockResolvedValue(mockPatientData);
    (signalServiceModule.signalService.process as any) = vi.fn().mockResolvedValue(mockSignal);
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
    const processMock = vi.fn().mockResolvedValue(mockSignal);
    (signalServiceModule.signalService.process as any) = processMock;
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
});
