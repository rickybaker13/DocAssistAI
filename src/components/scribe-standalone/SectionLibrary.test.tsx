import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SectionLibrary } from './SectionLibrary';
import { useScribeBuilderStore } from '../../stores/scribeBuilderStore';

const mockTemplates = [
  { id: '1', name: 'HPI', prompt_hint: null, is_prebuilt: 1 },
  { id: '2', name: 'Assessment', prompt_hint: null, is_prebuilt: 1 },
  { id: '3', name: 'Vasopressor Status', prompt_hint: 'ICU section', is_prebuilt: 1 },
];

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ templates: mockTemplates }),
});

describe('SectionLibrary', () => {
  beforeEach(() => useScribeBuilderStore.getState().clearCanvas());

  it('renders section names after loading', async () => {
    render(<SectionLibrary />);
    await waitFor(() => expect(screen.getByText('HPI')).toBeInTheDocument());
    expect(screen.getByText('Assessment')).toBeInTheDocument();
  });

  it('has a search input that filters sections', async () => {
    render(<SectionLibrary />);
    await waitFor(() => screen.getByText('HPI'));
    const search = screen.getByPlaceholderText(/search/i);
    fireEvent.change(search, { target: { value: 'vasopressor' } });
    expect(screen.queryByText('HPI')).not.toBeInTheDocument();
    expect(screen.getByText('Vasopressor Status')).toBeInTheDocument();
  });

  it('clicking a section adds it to the canvas store', async () => {
    render(<SectionLibrary />);
    await waitFor(() => screen.getByText('HPI'));
    fireEvent.click(screen.getByText('HPI'));
    expect(useScribeBuilderStore.getState().canvasSections).toHaveLength(1);
    expect(useScribeBuilderStore.getState().canvasSections[0].name).toBe('HPI');
  });
});
