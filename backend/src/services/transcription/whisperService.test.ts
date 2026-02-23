import { WhisperService } from './whisperService';

describe('WhisperService', () => {
  it('throws if no audio buffer provided', async () => {
    const svc = new WhisperService();
    await expect(svc.transcribe(Buffer.alloc(0), 'audio/webm')).rejects.toThrow('Empty audio buffer');
  });

  it('returns transcript string on valid input', async () => {
    const svc = new WhisperService();
    jest.spyOn(svc as any, 'callWhisper').mockResolvedValue('Patient presents with shortness of breath.');
    const result = await svc.transcribe(Buffer.from('fake'), 'audio/webm');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
