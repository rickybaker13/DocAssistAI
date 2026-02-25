import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { SectionLibrary } from './SectionLibrary';
import { useScribeBuilderStore } from '../../stores/scribeBuilderStore';

// Mock auth store — no specialty set by default (shows "All Sections" tab)
vi.mock('../../stores/scribeAuthStore', () => ({
  useScribeAuthStore: () => ({ user: { id: '1', email: 'test@test.com', name: 'Test', specialty: null } }),
}));

const mockTemplates = [
  { id: '1', name: 'HPI',              prompt_hint: null,          is_prebuilt: 1, category: 'general', disciplines: '[]' },
  { id: '2', name: 'Assessment',       prompt_hint: null,          is_prebuilt: 1, category: 'general', disciplines: '[]' },
  { id: '3', name: 'Vasopressor Status', prompt_hint: 'ICU section', is_prebuilt: 1, category: 'icu',  disciplines: '[]' },
];

const renderInRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

global.fetch = vi.fn();

describe('SectionLibrary', () => {
  beforeEach(() => {
    useScribeBuilderStore.getState().clearCanvas();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ templates: mockTemplates }),
    });
  });
  afterEach(() => vi.clearAllMocks());

  it('renders section names after loading', async () => {
    renderInRouter(<SectionLibrary />);
    await waitFor(() => expect(screen.getByText('HPI')).toBeInTheDocument());
    expect(screen.getByText('Assessment')).toBeInTheDocument();
  });

  it('has a search input that filters sections', async () => {
    renderInRouter(<SectionLibrary />);
    await waitFor(() => screen.getByText('HPI'));
    const search = screen.getByPlaceholderText(/search/i);
    fireEvent.change(search, { target: { value: 'vasopressor' } });
    expect(screen.queryByText('HPI')).not.toBeInTheDocument();
    expect(screen.getByText('Vasopressor Status')).toBeInTheDocument();
  });

  it('clicking a section adds it to the canvas store', async () => {
    renderInRouter(<SectionLibrary />);
    await waitFor(() => screen.getByText('HPI'));
    fireEvent.click(screen.getByText('HPI'));
    expect(useScribeBuilderStore.getState().canvasSections).toHaveLength(1);
    expect(useScribeBuilderStore.getState().canvasSections[0].name).toBe('HPI');
  });
});
