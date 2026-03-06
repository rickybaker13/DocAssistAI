/**
 * Background Keep-Alive for iOS PWA
 *
 * Prevents iOS Safari from suspending the JS thread when the PWA is
 * backgrounded during audio recording.  Two mechanisms:
 *
 * 1. Silent audio loop — iOS treats pages with active <audio> playback
 *    as "audio apps" and keeps their JS execution alive (like Spotify).
 *    The <audio>.play() call MUST originate from a user-gesture call stack.
 *
 * 2. Screen Wake Lock — prevents the screen from dimming/locking.
 *    Supported on iOS Safari 16.4+.  Automatically released when the page
 *    is hidden, so we re-acquire it on visibilitychange.
 */

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
  private audioEl: HTMLAudioElement | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private visibilityHandler: (() => void) | null = null;

  /**
   * Start the keep-alive.  MUST be called from within a user-gesture
   * call stack (e.g. the record button click handler) so that iOS
   * allows the audio element to play.
   */
  async start(): Promise<void> {
    // --- 1. Silent audio loop ---
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

    // --- 2. Screen Wake Lock ---
    await this.requestWakeLock();

    // --- 3. Re-acquire wake lock when page becomes visible ---
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        void this.requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  /** Release all resources.  Safe to call multiple times. */
  stop(): void {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = '';
      this.audioEl = null;
    }

    if (this.wakeLock) {
      void this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
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
}
