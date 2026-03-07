import { WhisperService } from './whisperService';

// Save/restore env helpers
const savedEnv = { ...process.env };
afterEach(() => {
  process.env = { ...savedEnv };
});

describe('WhisperService', () => {
  it('throws if no audio buffer provided', async () => {
    const svc = new WhisperService();
    await expect(svc.transcribe(Buffer.alloc(0), 'audio/webm')).rejects.toThrow('Empty audio buffer');
  });

  describe('self-hosted path (no GROQ_API_KEY)', () => {
    beforeEach(() => {
      delete process.env.GROQ_API_KEY;
      process.env.WHISPER_API_URL = 'http://whisper:9000';
    });

    it('returns transcript string on valid input', async () => {
      const svc = new WhisperService();
      jest.spyOn(svc as any, 'callSelfHosted').mockResolvedValue('Patient presents with shortness of breath.');
      const result = await svc.transcribe(Buffer.from('fake'), 'audio/webm');
      expect(result).toBe('Patient presents with shortness of breath.');
    });

    it('throws when WHISPER_API_URL is not set', async () => {
      delete process.env.WHISPER_API_URL;
      const svc = new WhisperService();
      await expect(svc.transcribe(Buffer.from('fake'), 'audio/webm')).rejects.toThrow(
        'WHISPER_API_URL is required'
      );
    });
  });

  describe('Groq path (GROQ_API_KEY set)', () => {
    beforeEach(() => {
      process.env.GROQ_API_KEY = 'gsk_test_key_123';
    });

    it('uses Groq when GROQ_API_KEY is set', async () => {
      const svc = new WhisperService();
      const groqSpy = jest.spyOn(svc as any, 'callGroq').mockResolvedValue('Groq transcript result.');
      const selfHostedSpy = jest.spyOn(svc as any, 'callSelfHosted');

      const result = await svc.transcribe(Buffer.from('fake'), 'audio/webm');

      expect(result).toBe('Groq transcript result.');
      expect(groqSpy).toHaveBeenCalledWith(Buffer.from('fake'), 'audio/webm', 'gsk_test_key_123');
      expect(selfHostedSpy).not.toHaveBeenCalled();
    });

    it('does not fall back to self-hosted when Groq is configured', async () => {
      const svc = new WhisperService();
      jest.spyOn(svc as any, 'callGroq').mockRejectedValue(new Error('Groq Whisper returned 500: server error'));
      const selfHostedSpy = jest.spyOn(svc as any, 'callSelfHosted');

      await expect(svc.transcribe(Buffer.from('fake'), 'audio/webm')).rejects.toThrow('Groq Whisper returned 500');
      expect(selfHostedSpy).not.toHaveBeenCalled();
    });

    it('ignores whitespace-only GROQ_API_KEY and falls back to self-hosted', async () => {
      process.env.GROQ_API_KEY = '   ';
      process.env.WHISPER_API_URL = 'http://whisper:9000';
      const svc = new WhisperService();
      const selfHostedSpy = jest.spyOn(svc as any, 'callSelfHosted').mockResolvedValue('Self-hosted result.');
      const groqSpy = jest.spyOn(svc as any, 'callGroq');

      const result = await svc.transcribe(Buffer.from('fake'), 'audio/webm');

      expect(result).toBe('Self-hosted result.');
      expect(selfHostedSpy).toHaveBeenCalled();
      expect(groqSpy).not.toHaveBeenCalled();
    });
  });
});
