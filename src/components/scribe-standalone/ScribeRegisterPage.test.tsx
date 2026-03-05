import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScribeRegisterPage } from './ScribeRegisterPage';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';

vi.mock('../../stores/scribeAuthStore');

const mockRegister = vi.fn();

const renderPage = () => render(
  <MemoryRouter>
    <ScribeRegisterPage />
  </MemoryRouter>,
);

describe('ScribeRegisterPage', () => {
  beforeEach(() => {
    mockRegister.mockReset();
    (useScribeAuthStore as any).mockReturnValue({
      register: mockRegister,
      loading: false,
      error: null,
      user: null,
    });
  });

  it('renders a free 7-day trial offer and billing fields', () => {
    renderPage();

    expect(screen.getByAltText(/square/i)).toBeInTheDocument();
    expect(screen.getByText(/start your free 7-day trial/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cardholder name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/card number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/expiry/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cvc/i)).toBeInTheDocument();
  });

  it('requires agreeing to auto-renewal before submitting', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'trial@docassist.ai' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/cardholder name/i), { target: { value: 'Dr Test User' } });
    fireEvent.change(screen.getByLabelText(/card number/i), { target: { value: '4242 4242 4242 4242' } });
    fireEvent.change(screen.getByLabelText(/expiry/i), { target: { value: '08/29' } });
    fireEvent.change(screen.getByLabelText(/cvc/i), { target: { value: '123' } });

    fireEvent.click(screen.getByRole('button', { name: /start free trial/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/must agree to auto-renewal/i);
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });
});
