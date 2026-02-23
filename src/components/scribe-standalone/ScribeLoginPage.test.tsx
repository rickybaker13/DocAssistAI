import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScribeLoginPage } from './ScribeLoginPage';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';

// Mock the store
vi.mock('../../stores/scribeAuthStore');
const mockLogin = vi.fn();
(useScribeAuthStore as any).mockReturnValue({ login: mockLogin, loading: false, error: null, user: null });

describe('ScribeLoginPage', () => {
  it('renders email and password fields', () => {
    render(<MemoryRouter><ScribeLoginPage /></MemoryRouter>);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders a Sign in button', () => {
    render(<MemoryRouter><ScribeLoginPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('calls login with email and password on submit', async () => {
    mockLogin.mockResolvedValueOnce(true);
    render(<MemoryRouter><ScribeLoginPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('a@b.com', 'password123', false));
  });

  it('has a link to the register page', () => {
    render(<MemoryRouter><ScribeLoginPage /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /create account/i })).toBeInTheDocument();
  });
});
