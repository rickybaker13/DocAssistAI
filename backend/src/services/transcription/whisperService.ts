import OpenAI from 'openai';

export class WhisperService {
  private _client: OpenAI | null = null;

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
    return this.callWhisper(audioBuffer, mimeType);
  }

  private async callWhisper(audioBuffer: Buffer, mimeType: string): Promise<string> {
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
