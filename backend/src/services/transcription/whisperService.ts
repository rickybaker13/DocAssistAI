import OpenAI from 'openai';

export class WhisperService {
  private _client: OpenAI | null = null;

  /** True when WHISPER_API_URL points to a self-hosted Whisper container. */
  private get selfHosted(): boolean {
    return !!process.env.WHISPER_API_URL;
  }

  private get client(): OpenAI {
    if (!this._client) {
      this._client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this._client;
  }

  async transcribe(audioBuffer: Buffer, mimeType: string): Promise<string> {
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Empty audio buffer');
    }
    return this.selfHosted
      ? this.callSelfHosted(audioBuffer, mimeType)
      : this.callOpenAI(audioBuffer, mimeType);
  }

  /**
   * Call the self-hosted Whisper ASR container (onerahmet/openai-whisper-asr-webservice).
   * Endpoint: POST /asr?task=transcribe&language=en&output=json
   */
  private async callSelfHosted(audioBuffer: Buffer, mimeType: string): Promise<string> {
    const baseUrl = (process.env.WHISPER_API_URL || '').trim().replace(/\/+$/, '');
    const timeoutMs = parseInt(process.env.WHISPER_TIMEOUT_MS || '120000', 10);
    const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'wav';

    const form = new FormData();
    form.append(
      'audio_file',
      new Blob([audioBuffer], { type: mimeType }),
      `recording.${ext}`,
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        `${baseUrl}/asr?task=transcribe&language=en&output=json`,
        { method: 'POST', body: form, signal: controller.signal },
      );

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Whisper ASR returned ${response.status}: ${body}`);
      }

      const result = (await response.json()) as { text: string };
      return result.text;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Call the OpenAI Whisper cloud API. */
  private async callOpenAI(audioBuffer: Buffer, mimeType: string): Promise<string> {
    const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'wav';
    const file = new File([audioBuffer], `recording.${ext}`, { type: mimeType });
    const response = await this.client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en',
      prompt: 'Medical clinical encounter. Use medical terminology accurately.',
    });
    return response.text;
  }
}
