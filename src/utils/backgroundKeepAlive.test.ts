import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackgroundKeepAlive } from './backgroundKeepAlive';

let mockPlay: ReturnType<typeof vi.fn>;
let mockPause: ReturnType<typeof vi.fn>;
let mockAudioInstance: Record<string, unknown>;
let mockVideoEl: Record<string, unknown>;
let mockVideoPlay: ReturnType<typeof vi.fn>;
let mockVideoPause: ReturnType<typeof vi.fn>;
let mockVideoRemove: ReturnType<typeof vi.fn>;
let mockOscillator: Record<string, unknown>;
let mockGainNode: Record<string, unknown>;
let mockAudioCtx: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();

  // --- Audio element mock ---
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

  // --- Video element mock ---
  mockVideoPlay = vi.fn().mockResolvedValue(undefined);
  mockVideoPause = vi.fn();
  mockVideoRemove = vi.fn();
  mockVideoEl = {
    play: mockVideoPlay,
    pause: mockVideoPause,
    remove: mockVideoRemove,
    setAttribute: vi.fn(),
    loop: false,
    src: '',
    style: {},
  };

  const origCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'video') return mockVideoEl as unknown as HTMLVideoElement;
    return origCreateElement(tag);
  });
  vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el);

  // --- Wake lock mock ---
  const mockRelease = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'wakeLock', {
    value: {
      request: vi.fn().mockResolvedValue({ release: mockRelease }),
    },
    configurable: true,
    writable: true,
  });

  // --- Web Audio API mock ---
  mockOscillator = {
    frequency: { value: 440 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  };
  mockGainNode = {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  mockAudioCtx = {
    createOscillator: vi.fn().mockReturnValue(mockOscillator),
    createGain: vi.fn().mockReturnValue(mockGainNode),
    destination: {},
    state: 'running',
    close: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
  };
  // Use vi.stubGlobal for reliable constructor mocking in vitest 4
  vi.stubGlobal('AudioContext', vi.fn().mockImplementation(function () { return mockAudioCtx; }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('BackgroundKeepAlive', () => {
  it('plays silent video on start', async () => {
    const keepAlive = new BackgroundKeepAlive();
    await keepAlive.start();

    expect(document.createElement).toHaveBeenCalledWith('video');
    expect(mockVideoPlay).toHaveBeenCalledTimes(1);
    expect(mockVideoEl.loop).toBe(true);
    keepAlive.stop();
  });

  it('plays silent audio on start', async () => {
    const keepAlive = new BackgroundKeepAlive();
    await keepAlive.start();

    expect(global.Audio).toHaveBeenCalledTimes(1);
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

  it('starts Web Audio API oscillator', async () => {
    const keepAlive = new BackgroundKeepAlive();
    await keepAlive.start();

    expect(mockAudioCtx.createOscillator).toHaveBeenCalledTimes(1);
    expect(mockAudioCtx.createGain).toHaveBeenCalledTimes(1);
    expect(mockOscillator.frequency.value).toBe(1);
    expect(mockGainNode.gain.value).toBe(0.001);
    expect(mockOscillator.connect).toHaveBeenCalledWith(mockGainNode);
    expect(mockGainNode.connect).toHaveBeenCalledWith(mockAudioCtx.destination);
    expect(mockOscillator.start).toHaveBeenCalledWith(0);
    keepAlive.stop();
  });

  it('requests wake lock on start', async () => {
    const keepAlive = new BackgroundKeepAlive();
    await keepAlive.start();

    expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
    keepAlive.stop();
  });

  it('pauses audio and video on stop', async () => {
    const keepAlive = new BackgroundKeepAlive();
    await keepAlive.start();
    keepAlive.stop();

    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(mockVideoPause).toHaveBeenCalledTimes(1);
    expect(mockVideoRemove).toHaveBeenCalledTimes(1);
  });

  it('closes AudioContext on stop', async () => {
    const keepAlive = new BackgroundKeepAlive();
    await keepAlive.start();
    keepAlive.stop();

    expect(mockOscillator.stop).toHaveBeenCalledTimes(1);
    expect(mockOscillator.disconnect).toHaveBeenCalledTimes(1);
    expect(mockAudioCtx.close).toHaveBeenCalledTimes(1);
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

  it('does not throw if video.play() rejects', async () => {
    mockVideoPlay = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    mockVideoEl.play = mockVideoPlay;

    const keepAlive = new BackgroundKeepAlive();
    await expect(keepAlive.start()).resolves.toBeUndefined();
    keepAlive.stop();
  });

  it('does not throw if AudioContext is unsupported', async () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);

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

  it('restart() resumes video, audio, AudioContext and re-acquires wake lock', async () => {
    const keepAlive = new BackgroundKeepAlive();
    await keepAlive.start();

    // Simulate AudioContext being suspended after background
    (mockAudioCtx as any).state = 'suspended';

    await keepAlive.restart();

    // video play() called twice: once on start, once on restart
    expect(mockVideoPlay).toHaveBeenCalledTimes(2);
    // audio play() called twice: once on start, once on restart
    expect(mockPlay).toHaveBeenCalledTimes(2);
    // AudioContext.resume() called on restart
    expect(mockAudioCtx.resume).toHaveBeenCalledTimes(1);
    // wakeLock requested on start + restart
    expect((navigator.wakeLock as any).request).toHaveBeenCalledTimes(2);
  });
});
