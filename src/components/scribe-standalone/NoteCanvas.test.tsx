import { render, screen, fireEvent } from '@testing-library/react';
import { NoteCanvas } from './NoteCanvas';
import { useScribeBuilderStore } from '../../stores/scribeBuilderStore';

describe('NoteCanvas', () => {
  beforeEach(() => {
    useScribeBuilderStore.getState().clearCanvas();
    useScribeBuilderStore.getState().addSection({ id: 'a', name: 'HPI', promptHint: null, isPrebuilt: true });
    useScribeBuilderStore.getState().addSection({ id: 'b', name: 'Assessment', promptHint: null, isPrebuilt: true });
  });

  it('renders section names from canvas store', () => {
    render(<NoteCanvas />);
    expect(screen.getByText('HPI')).toBeInTheDocument();
    expect(screen.getByText('Assessment')).toBeInTheDocument();
  });

  it('shows empty state when canvas is empty', () => {
    useScribeBuilderStore.getState().clearCanvas();
    render(<NoteCanvas />);
    expect(screen.getByText(/add sections/i)).toBeInTheDocument();
  });

  it('removes section when × is clicked', () => {
    render(<NoteCanvas />);
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(removeButtons[0]);
    expect(useScribeBuilderStore.getState().canvasSections).toHaveLength(1);
  });
});
