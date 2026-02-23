import { render, screen } from '@testing-library/react';
import { ScribePanel } from './ScribePanel';
import { useScribeStore } from '../../stores/scribeStore';

beforeEach(() => {
  useScribeStore.getState().reset();
});

describe('ScribePanel', () => {
  it('renders note type selector with Progress Note as default', () => {
    render(<ScribePanel />);
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('Progress Note');
  });

  it('shows transcript when store has transcript', () => {
    useScribeStore.setState({ transcript: 'Patient presents with SOB.' });
    render(<ScribePanel />);
    expect(screen.getByText('Patient presents with SOB.')).toBeInTheDocument();
  });

  it('shows generating spinner when isGenerating is true', () => {
    useScribeStore.setState({ isGenerating: true });
    render(<ScribePanel />);
    expect(screen.getByText(/generating/i)).toBeInTheDocument();
  });

  it('shows error message when store has error', () => {
    useScribeStore.setState({ error: 'Network error' });
    render(<ScribePanel />);
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });
});
