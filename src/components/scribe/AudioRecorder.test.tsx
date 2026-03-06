import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { vi, beforeEach, describe, it, expect } from 'vitest';
import { AudioRecorder } from './AudioRecorder';
import { useScribeStore } from '../../stores/scribeStore';

// Mock the background keep-alive utility (iOS-specific, not testable in jsdom).
// Must use a class (not arrow fn) so `new BackgroundKeepAlive()` works.
vi.mock('../../utils/backgroundKeepAlive', () => ({
  BackgroundKeepAlive: class {
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn();
    restart = vi.fn().mockResolvedValue(undefined);
  },
}));

// Proper MediaRecorder mock using a class so vitest doesn't warn
class MockMediaRecorder {
  state = 'inactive';
  start = vi.fn().mockImplementation(function (this: MockMediaRecorder) {
    this.state = 'recording';
  });
  stop = vi.fn().mockImplementation(function (this: MockMediaRecorder) {
    this.state = 'inactive';
  });
  ondataavailable: ((e: Event) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {}

  static isTypeSupported = vi.fn().mockReturnValue(false);
}

beforeEach(() => {
  vi.clearAllMocks();

  // Reset the Zustand store so each test starts from a clean slate
  useScribeStore.getState().reset();

  // Mock getUserMedia to return a fake stream
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    },
    configurable: true,
    writable: true,
  });

  // Replace global MediaRecorder with the class mock
  global.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;
});

describe('AudioRecorder', () => {
  it('renders Record button initially', () => {
    render(<AudioRecorder onTranscript={() => {}} />);
    expect(screen.getByRole('button', { name: /record/i })).toBeInTheDocument();
  });

  it('shows Stop button while recording', async () => {
    render(<AudioRecorder onTranscript={() => {}} />);

    // startRecording() is async and fire-and-forget from React's onClick,
    // so act() alone can't track when the chain completes. Use waitFor to
    // poll until getUserMedia → keepAlive.start() → setRecording(true) finish.
    fireEvent.click(screen.getByRole('button', { name: /record/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    });
  });

  it('calls onError when getUserMedia is rejected', async () => {
    const micError = new Error('Permission denied');
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockRejectedValue(micError),
      },
      configurable: true,
      writable: true,
    });

    const onError = vi.fn();
    render(<AudioRecorder onTranscript={() => {}} onError={onError} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /record/i }));
    });

    expect(onError).toHaveBeenCalledWith('Permission denied');
    expect(screen.getByRole('button', { name: /record/i })).toBeInTheDocument();
  });

  it('does not show interruption banner initially', async () => {
    render(<AudioRecorder onTranscript={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: /record/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
    });

    expect(screen.queryByText(/recording interrupted/i)).not.toBeInTheDocument();
  });
});
