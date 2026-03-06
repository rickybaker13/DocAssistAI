import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackgroundKeepAlive } from './backgroundKeepAlive';

let mockPlay: ReturnType<typeof vi.fn>;
let mockPause: ReturnType<typeof vi.fn>;
let mockAudioInstance: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();

  mockPlay = vi.fn().mockResolvedValue(undefined);
  mockPause = vi.fn();
  mockAudioInstance = {
    play: mockPlay,
    pause: mockPause,
    loop: false,
    volume: 1,
    src: '',
  };

  global.Audio = vi.fn().mockImplementation(function (this: unknown, src: string) {
    mockAudioInstance.src = src;
    return mockAudioInstance;
  }) as unknown as typeof Audio;

  const mockRelease = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'wakeLock', {
    value: {
      request: vi.fn().mockResolvedValue({ release: mockRelease }),
    },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BackgroundKeepAlive', () => {
  it('plays silent audio on start', async () => {
    const keepAlive = new BackgroundKeepAlive();
    await keepAlive.start();

    expect(global.Audio).toHaveBeenCalledTimes(1);
    // Verify Audio was called with a data URL containing a WAV base64 payload
    expect(global.Audio).toHaveBeenCalledWith(expect.stringMatching(/^data:audio\/wav;base64,/));
    expect(mockPlay).toHaveBeenCalledTimes(1);
    keepAlive.stop();
  });

  it('sets audio to loop at low volume', async () => {
    const keepAlive = new BackgroundKeepAlive();
    await keepAlive.start();

    expect(mockAudioInstance.loop).toBe(true);
    expect(mockAudioInstance.volume).toBe(0.01);
    keepAlive.stop();
  });

  it('requests wake lock on start', async () => {
    const keepAlive = new BackgroundKeepAlive();
    await keepAlive.start();

    expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
    keepAlive.stop();
  });

  it('pauses audio on stop', async () => {
    const keepAlive = new BackgroundKeepAlive();
    await keepAlive.start();
    keepAlive.stop();

    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  it('adds visibilitychange listener on start and removes on stop', async () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const keepAlive = new BackgroundKeepAlive();
    await keepAlive.start();

    expect(addSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    keepAlive.stop();

    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('does not throw if wakeLock is unsupported', async () => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const keepAlive = new BackgroundKeepAlive();
    await expect(keepAlive.start()).resolves.toBeUndefined();
    keepAlive.stop();
  });

  it('does not throw if audio.play() rejects', async () => {
    mockPlay = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    mockAudioInstance.play = mockPlay;

    const keepAlive = new BackgroundKeepAlive();
    await expect(keepAlive.start()).resolves.toBeUndefined();
    keepAlive.stop();
  });

  it('stop is safe to call multiple times', async () => {
    const keepAlive = new BackgroundKeepAlive();
    await keepAlive.start();
    keepAlive.stop();
    keepAlive.stop(); // Should not throw
  });
});
