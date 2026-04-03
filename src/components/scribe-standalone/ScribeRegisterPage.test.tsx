import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ScribeRegisterPage } from './ScribeRegisterPage';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';

vi.mock('../../stores/scribeAuthStore');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockRegister = vi.fn();

const renderPage = () => render(
  <MemoryRouter>
    <ScribeRegisterPage />
  </MemoryRouter>,
);

describe('ScribeRegisterPage', () => {
  beforeEach(() => {
    mockRegister.mockReset();
    mockNavigate.mockReset();
    (useScribeAuthStore as any).mockReturnValue({
      register: mockRegister,
      loading: false,
      error: null,
      user: null,
    });
  });

  it('renders role selector cards', () => {
    renderPage();
    expect(screen.getByText('Clinical Professional')).toBeInTheDocument();
    expect(screen.getByText('Billing & Coding')).toBeInTheDocument();
  });

  it('shows trial banner with default text', () => {
    renderPage();
    expect(screen.getByText(/start your free 7-day trial/i)).toBeInTheDocument();
  });

  it('shows specialty dropdown only when clinical is selected', () => {
    renderPage();
    // Specialty not visible before selection
    expect(screen.queryByLabelText(/specialty/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Clinical Professional'));
    expect(screen.getByLabelText(/specialty/i)).toBeInTheDocument();
  });

  it('shows coding path options when billing & coding is selected', () => {
    renderPage();
    fireEvent.click(screen.getByText('Billing & Coding'));

    expect(screen.getByText(/I'm starting a new coding team/i)).toBeInTheDocument();
    expect(screen.getByText(/I have an invitation from my team/i)).toBeInTheDocument();
  });

  it('shows invitation help text when invited path is selected', () => {
    renderPage();
    fireEvent.click(screen.getByText('Billing & Coding'));
    fireEvent.click(screen.getByText(/I have an invitation from my team/i));

    expect(screen.getByText(/check your email for an invitation link/i)).toBeInTheDocument();
  });

  it('updates trial banner for coding manager path', () => {
    renderPage();
    fireEvent.click(screen.getByText('Billing & Coding'));
    fireEvent.click(screen.getByText(/I'm starting a new coding team/i));

    expect(screen.getByText('Start your coding team')).toBeInTheDocument();
    expect(screen.getByText(/create your team account and invite billing coders/i)).toBeInTheDocument();
  });

  it('disables submit when no account type is selected', () => {
    renderPage();
    const button = screen.getByRole('button', { name: /start free trial/i });
    expect(button).toBeDisabled();
  });

  it('disables submit when coding is selected but no path chosen', () => {
    renderPage();
    fireEvent.click(screen.getByText('Billing & Coding'));
    const button = screen.getByRole('button', { name: /start free trial/i });
    expect(button).toBeDisabled();
  });

  it('disables submit when invited path is selected', () => {
    renderPage();
    fireEvent.click(screen.getByText('Billing & Coding'));
    fireEvent.click(screen.getByText(/I have an invitation from my team/i));
    const button = screen.getByRole('button', { name: /start free trial/i });
    expect(button).toBeDisabled();
  });

  it('submits clinical registration and navigates to scribe dashboard', async () => {
    mockRegister.mockResolvedValue(true);
    renderPage();

    fireEvent.click(screen.getByText('Clinical Professional'));
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'doc@hospital.org' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /start free trial/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('doc@hospital.org', 'password123', '', '', undefined);
    });
    expect(mockNavigate).toHaveBeenCalledWith('/scribe/dashboard');
  });

  it('submits coding manager registration and navigates to coder team', async () => {
    mockRegister.mockResolvedValue(true);
    renderPage();

    fireEvent.click(screen.getByText('Billing & Coding'));
    fireEvent.click(screen.getByText(/I'm starting a new coding team/i));
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'coder@billing.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /create coding team/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('coder@billing.com', 'password123', '', '', 'coding_manager');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/coder/team');
  });

  it('shows error message when registration fails', () => {
    (useScribeAuthStore as any).mockReturnValue({
      register: mockRegister,
      loading: false,
      error: 'Email already registered',
      user: null,
    });
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Email already registered');
  });

  it('shows coding pricing text when coding is selected', () => {
    renderPage();
    fireEvent.click(screen.getByText('Billing & Coding'));
    expect(screen.getByText(/coding team plans start at \$99\/mo/i)).toBeInTheDocument();
  });

  it('shows clinical pricing text when clinical is selected', () => {
    renderPage();
    fireEvent.click(screen.getByText('Clinical Professional'));
    expect(screen.getByText(/after your trial, plans start at \$20\/mo/i)).toBeInTheDocument();
  });
});
