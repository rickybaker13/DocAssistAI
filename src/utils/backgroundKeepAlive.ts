/**
 * Background Keep-Alive for iOS PWA
 *
 * Prevents iOS Safari from suspending the JS thread when the PWA is
 * backgrounded during audio recording.  Five mechanisms:
 *
 * 1. Silent VIDEO loop — iOS treats pages with active <video playsinline>
 *    playback with higher priority than <audio>. This is the technique used
 *    by NoSleep.js and is the most reliable way to keep JS alive.
 *    The play() call MUST originate from a user-gesture call stack.
 *
 * 2. Silent audio loop (fallback) — iOS treats pages with active <audio>
 *    playback as "audio apps" and keeps their JS execution alive.
 *
 * 3. Web Audio API oscillator — runs on a dedicated audio rendering thread,
 *    separate from the main JS thread. More resilient to main-thread
 *    suspension than <audio>/<video> elements.
 *
 * 4. Screen Wake Lock — prevents the screen from dimming/locking.
 *    Supported on iOS Safari 16.4+.  Automatically released when the page
 *    is hidden, so we re-acquire it on visibilitychange.
 *
 * 5. MediaSession API — registers an active media session with metadata
 *    so iOS shows lock screen controls and treats the app as a media app.
 *    This may extend background execution and helps the user see that
 *    recording is in progress from the lock screen.
 */

/**
 * Builds a minimal silent MP4 video (base64) for the video keep-alive.
 * This is a tiny valid MP4 with one black frame — iOS requires a real
 * video source to grant background execution priority.
 * Source: NoSleep.js project, Apache 2.0 license.
 */
const SILENT_MP4 =
  'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAA' +
  'AhRtZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE0OCByMjY0MyA1YzY1' +
  'NzA0IC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxNSAtIGh0dHA6' +
  'Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVi' +
  'bG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9' +
  'MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MDgg' +
  'OHg4ZGN0PTEgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZz' +
  'ZXQ9LTIgdGhyZWFkcz02IGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0w' +
  'IGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRy' +
  'YT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiBiX2FkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2Vp' +
  'Z2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0yIGtleWludD0yNTAga2V5aW50X21pbj0yNSBzY2Vu' +
  'ZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9va2FoZWFkPTQwIHJjPWNyZiBtYnRyZWU9MSBj' +
  'cmY9MjguMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40' +
  'MCBhcT0xOjEuMDAAgAAAAA9liIQAV/0TAAYdeBTXzg8AAALvbW9vdgAAAGxtdmhkAAAAAAAAAAAA' +
  'AAAAAAAeQAAACAAAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAMAAAB0dHJhawAAAFx0a2hkAAAADwAAAAAAAAAAAAAAAQAAAAAAAAgAAAAA' +
  'AAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAACAAAAAgAAAAAACRl' +
  'ZHRzAAAAHGVsc3QAAAAAAAEAAAALAAABAAAAAAEAAAAAAWJ0cmFrAAAAXHRraGQAAAAPAAAAAAAAAAAA' +
  'AAAAAQAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABA' +
  'AAAAAAAAAAAAAAAAAAAkZWR0cwAAABxlbHN0AAAAAAEAAAAACwAAAQAAAAABAAAA';

/** Builds a minimal 1-second silent WAV as a data URL (no network fetch). */
function createSilentWavDataUrl(): string {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = sampleRate; // 1 second
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = numSamples * numChannels * bytesPerSample;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);                                         // sub-chunk size (PCM = 16)
  view.setUint16(20, 1, true);                                          // audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);   // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true);                // block align
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk (bytes 44..end are already zero = silence)
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Encode as base64 data URL to avoid blob URL lifecycle issues
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

export class BackgroundKeepAlive {
  private videoEl: HTMLVideoElement | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private oscillatorNode: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private visibilityHandler: (() => void) | null = null;

  /**
   * Start the keep-alive.  MUST be called from within a user-gesture
   * call stack (e.g. the record button click handler) so that iOS
   * allows the video/audio elements to play and AudioContext to resume.
   */
  async start(): Promise<void> {
    // --- 1. Silent VIDEO loop (highest priority on iOS) ---
    try {
      this.videoEl = document.createElement('video');
      this.videoEl.setAttribute('playsinline', '');
      this.videoEl.setAttribute('muted', '');
      // Not using .muted=true on purpose — some iOS versions treat
      // muted video with lower priority. Instead we use a video with
      // an inaudible audio track at near-zero volume.
      this.videoEl.loop = true;
      this.videoEl.style.position = 'fixed';
      this.videoEl.style.top = '-1px';
      this.videoEl.style.left = '-1px';
      this.videoEl.style.width = '1px';
      this.videoEl.style.height = '1px';
      this.videoEl.style.opacity = '0.01';
      this.videoEl.src = SILENT_MP4;
      document.body.appendChild(this.videoEl);
      await this.videoEl.play();
    } catch {
      // Non-fatal: fall through to audio element fallback
      this.cleanupVideo();
    }

    // --- 2. Silent audio loop (fallback) ---
    try {
      this.audioEl = new Audio(createSilentWavDataUrl());
      this.audioEl.loop = true;
      // Use 0.01 not 0 — some iOS versions optimize away zero volume
      this.audioEl.volume = 0.01;
      await this.audioEl.play();
    } catch {
      // Non-fatal: recording still works, just may not survive background
      this.audioEl = null;
    }

    // --- 3. Web Audio API oscillator (separate audio thread) ---
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        // Create an oscillator at 1Hz (inaudible) routed through near-zero gain
        this.oscillatorNode = this.audioCtx.createOscillator();
        this.oscillatorNode.frequency.value = 1; // 1Hz — well below audible range
        this.gainNode = this.audioCtx.createGain();
        this.gainNode.gain.value = 0.001; // Essentially silent
        this.oscillatorNode.connect(this.gainNode);
        this.gainNode.connect(this.audioCtx.destination);
        this.oscillatorNode.start(0);
      }
    } catch {
      // Non-fatal
      this.cleanupAudioContext();
    }

    // --- 4. Screen Wake Lock ---
    await this.requestWakeLock();

    // --- 5. MediaSession API (lock screen presence) ---
    this.registerMediaSession();

    // --- 6. Re-acquire wake lock + resume AudioContext when page becomes visible ---
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        void this.requestWakeLock();
        // AudioContext may be suspended when returning from background
        if (this.audioCtx?.state === 'suspended') {
          void this.audioCtx.resume().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  /** Release all resources.  Safe to call multiple times. */
  stop(): void {
    this.cleanupVideo();

    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = '';
      this.audioEl = null;
    }

    this.cleanupAudioContext();

    if (this.wakeLock) {
      void this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    this.clearMediaSession();
  }

  /**
   * Restart the keep-alive after iOS suspended it (e.g. returning from
   * another app).  Tries to resume existing media elements — iOS
   * allows play() on previously-playing elements from visibilitychange.
   * Re-acquires wake lock.  Safe to call even if currently stopped.
   */
  async restart(): Promise<void> {
    // Try to resume video element
    if (this.videoEl) {
      try {
        await this.videoEl.play();
      } catch {
        this.cleanupVideo();
      }
    }

    // Try to resume existing audio element (avoids user-gesture requirement)
    if (this.audioEl) {
      try {
        await this.audioEl.play();
      } catch {
        // If resume fails, the audio element was fully destroyed by iOS.
        // We can't create a new one without a user gesture.
        this.audioEl = null;
      }
    }

    // Resume AudioContext if suspended
    if (this.audioCtx?.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {
        // Non-fatal
      }
    }

    // Re-acquire wake lock (always works on visibility change to 'visible')
    await this.requestWakeLock();
  }

  private cleanupVideo(): void {
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.src = '';
      this.videoEl.remove();
      this.videoEl = null;
    }
  }

  private cleanupAudioContext(): void {
    if (this.oscillatorNode) {
      try {
        this.oscillatorNode.stop();
        this.oscillatorNode.disconnect();
      } catch {
        // May already be stopped
      }
      this.oscillatorNode = null;
    }
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {
        // Non-fatal
      }
      this.gainNode = null;
    }
    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }

  private async requestWakeLock(): Promise<void> {
    if (!('wakeLock' in navigator)) return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
    } catch {
      // Non-fatal: screen may dim, but recording continues
    }
  }

  /**
   * Register a MediaSession so iOS/Android show "Recording…" on the
   * lock screen and treat the app as an active media session.
   * This extends background execution time on some devices.
   */
  private registerMediaSession(): void {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Recording in progress',
        artist: 'DocAssistAI',
        album: 'Scribe',
      });
      navigator.mediaSession.playbackState = 'playing';
      // No-op handlers prevent iOS from pausing the audio/video elements
      navigator.mediaSession.setActionHandler('play', () => {});
      navigator.mediaSession.setActionHandler('pause', () => {});
      navigator.mediaSession.setActionHandler('seekbackward', () => {});
      navigator.mediaSession.setActionHandler('seekforward', () => {});
      navigator.mediaSession.setActionHandler('previoustrack', () => {});
      navigator.mediaSession.setActionHandler('nexttrack', () => {});
    } catch {
      // Non-fatal
    }
  }

  private clearMediaSession(): void {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    } catch {
      // Non-fatal
    }
  }
}
