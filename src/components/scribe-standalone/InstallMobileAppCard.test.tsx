import { fireEvent, render, screen } from '@testing-library/react';
import { InstallMobileAppCard } from './InstallMobileAppCard';
import { usePwaInstall } from '../../hooks/usePwaInstall';

vi.mock('../../hooks/usePwaInstall');

describe('InstallMobileAppCard', () => {
  it('renders the download button when app is not installed', () => {
    (usePwaInstall as any).mockReturnValue({
      canInstall: false,
      isInstalled: false,
      needsIosInstructions: false,
      promptInstall: vi.fn(),
    });

    render(<InstallMobileAppCard />);

    expect(screen.getByRole('button', { name: /download the mobile app/i })).toBeInTheDocument();
  });

  it('opens iOS instructions when needed', () => {
    (usePwaInstall as any).mockReturnValue({
      canInstall: false,
      isInstalled: false,
      needsIosInstructions: true,
      promptInstall: vi.fn(),
    });

    render(<InstallMobileAppCard />);

    fireEvent.click(screen.getByRole('button', { name: /download the mobile app/i }));

    expect(screen.getByText(/install on iphone\/ipad/i)).toBeInTheDocument();
  });
});
