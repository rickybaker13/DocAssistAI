import { jest, describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { ScribeUserModel } from '../models/scribeUser.js';
import { initPool, closePool } from '../database/db.js';
import { runMigrations } from '../database/migrations.js';
import { piiScrubber, PiiServiceUnavailableError } from '../services/piiScrubber.js';

// In ESM mode, jest.mock at top-level is not hoisted correctly.
// We use jest.spyOn on the singleton aiService object instead,
// matching the pattern used in ai.test.ts.
import { aiService } from '../services/ai/aiService.js';
import scribeAiRouter from './scribeAi.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/ai/scribe', scribeAiRouter);

const SECRET = 'test-secret';
let authCookie: string;
let mockAiChat: ReturnType<typeof jest.spyOn>;
let mockScrub: ReturnType<typeof jest.spyOn>;
let mockReInject: ReturnType<typeof jest.spyOn>;

describe('Scribe AI Routes', () => {
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = SECRET;
    await initPool();
    await runMigrations();
    const user = await new ScribeUserModel().create({ email: 'ai-test@test.com', passwordHash: 'hash' });
    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1h' });
    authCookie = `scribe_token=${token}`;
    mockAiChat = jest.spyOn(aiService, 'chat');
    mockScrub = jest.spyOn(piiScrubber, 'scrub');
    mockReInject = jest.spyOn(piiScrubber, 'reInject');
  });
  beforeEach(() => {
    // Default pass-through mocks — existing tests are unaffected by the PII layer
    mockScrub.mockImplementation(async (fields) => ({
      scrubbedFields: { ...fields },
      subMap: {},
    }));
    mockReInject.mockImplementation((text) => text);
  });
  afterEach(() => {
    mockAiChat.mockReset();
    mockScrub.mockReset();
    mockReInject.mockReset();
  });
  afterAll(async () => {
    jest.restoreAllMocks();
    await closePool();
  });

  describe('POST /generate', () => {
    it('generates sections from transcript', async () => {
      mockAiChat.mockResolvedValueOnce({ content: JSON.stringify({
        sections: [
          { name: 'HPI', content: 'Patient presents with chest pain.', confidence: 0.9 },
          { name: 'Assessment', content: 'Likely ACS.', confidence: 0.85 },
        ],
      }) } as any);

      const res = await request(app)
        .post('/api/ai/scribe/generate')
        .set('Cookie', authCookie)
        .send({
          transcript: 'Patient came in with chest pain for 2 hours.',
          sections: [{ name: 'HPI', promptHint: '' }, { name: 'Assessment', promptHint: '' }],
          noteType: 'progress_note',
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.sections)).toBe(true);
      expect(res.body.sections[0].name).toBe('HPI');
      expect(res.body.sections[0].confidence).toBeDefined();
    });

    it('returns 400 if transcript is missing', async () => {
      const res = await request(app)
        .post('/api/ai/scribe/generate')
        .set('Cookie', authCookie)
        .send({ sections: [{ name: 'HPI' }] });
      expect(res.status).toBe(400);
    });

    it('returns 400 if sections array is empty', async () => {
      const res = await request(app)
        .post('/api/ai/scribe/generate')
        .set('Cookie', authCookie)
        .send({ transcript: 'text', sections: [] });
      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/ai/scribe/generate').send({ transcript: 'x', sections: [{ name: 'HPI' }] });
      expect(res.status).toBe(401);
    });

    it('POST /generate — accepts verbosity brief without error', async () => {
      mockAiChat.mockResolvedValueOnce({ content: JSON.stringify({
        sections: [
          { name: 'Assessment', content: 'Patient improving.', confidence: 0.9 },
        ],
      }) } as any);

      const res = await request(app)
        .post('/api/ai/scribe/generate')
        .set('Cookie', authCookie)
        .send({
          transcript: 'Patient is feeling better today.',
          sections: [{ name: 'Assessment', promptHint: null }],
          noteType: 'progress_note',
          verbosity: 'brief',
        });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.sections)).toBe(true);
    });

    it('system prompt includes ICD-10 terminology instruction', async () => {
      mockAiChat.mockResolvedValueOnce({ content: JSON.stringify({
        sections: [{ name: 'Assessment', content: 'Essential hypertension.', confidence: 0.9 }],
      }) } as any);
      await request(app).post('/api/ai/scribe/generate').set('Cookie', authCookie)
        .send({ transcript: 'HTN.', sections: [{ name: 'Assessment' }], noteType: 'progress_note' });
      const sys: string = (mockAiChat.mock.calls[0][0] as any).messages.find((m: any) => m.role === 'system')?.content ?? '';
      expect(sys).toMatch(/ICD-10|icd-10/i);
      expect(sys).toMatch(/essential.*hypertension|preferred terminology/i);
    });
  });

  describe('POST /focused', () => {
    it('returns focused analysis for a section', async () => {
      mockAiChat.mockResolvedValueOnce({ content: JSON.stringify({
        analysis: 'Deep analysis of the section.',
        citations: [{ guideline: 'Surviving Sepsis Campaign', recommendation: 'Use norepinephrine first-line' }],
        suggestions: ['Consider adding MAP targets'],
        confidence_breakdown: 'Content well-supported',
      }) } as any);

      const res = await request(app)
        .post('/api/ai/scribe/focused')
        .set('Cookie', authCookie)
        .send({
          sectionName: 'Vasopressor Status',
          content: 'Norepinephrine 0.1 mcg/kg/min.',
          transcript: 'Patient on norepinephrine.',
          specialty: 'Critical Care',
        });

      expect(res.status).toBe(200);
      expect(res.body.analysis).toBeDefined();
      expect(Array.isArray(res.body.citations)).toBe(true);
    });

    it('system prompt includes ICD-10 terminology instruction', async () => {
      mockAiChat.mockResolvedValueOnce({ content: JSON.stringify({
        analysis: 'Good.', citations: [], suggestions: [], confidence_breakdown: '',
      }) } as any);
      await request(app).post('/api/ai/scribe/focused').set('Cookie', authCookie)
        .send({ sectionName: 'Assessment', content: 'HTN.', transcript: '' });
      const sys: string = (mockAiChat.mock.calls[0][0] as any).messages.find((m: any) => m.role === 'system')?.content ?? '';
      expect(sys).toMatch(/ICD-10|icd-10/i);
    });
  });

  describe('POST /ghost-write', () => {
    it('returns ghost-written text in physician voice', async () => {
      mockAiChat.mockResolvedValueOnce({ content: 'We will obtain MRI brain with DWI protocol to evaluate for acute ischemic stroke.' } as any);

      const res = await request(app)
        .post('/api/ai/scribe/ghost-write')
        .set('Cookie', authCookie)
        .send({
          chatAnswer: 'MRI brain with DWI is indicated for stroke workup',
          destinationSection: 'Plan',
          existingContent: 'Will obtain CBC and BMP.',
          noteType: 'progress_note',
          specialty: 'Neurology',
        });

      expect(res.status).toBe(200);
      expect(typeof res.body.ghostWritten).toBe('string');
      expect(res.body.ghostWritten.length).toBeGreaterThan(0);
    });

    it('system prompt includes ICD-10 terminology instruction', async () => {
      mockAiChat.mockResolvedValueOnce({ content: 'Essential hypertension, on lisinopril.' } as any);
      await request(app).post('/api/ai/scribe/ghost-write').set('Cookie', authCookie)
        .send({ chatAnswer: 'HTN on lisinopril', destinationSection: 'Assessment' });
      const sys: string = (mockAiChat.mock.calls[0][0] as any).messages.find((m: any) => m.role === 'system')?.content ?? '';
      expect(sys).toMatch(/ICD-10|icd-10/i);
    });
  });

  describe('POST /resolve-suggestion', () => {
    it('returns ready=true with noteText when AI has enough context', async () => {
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({ ready: true, noteText: 'Ischemic stroke, left MCA territory.' }),
      } as any);

      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({
          suggestion: 'Document stroke type (ischemic vs hemorrhagic) and vascular territory',
          sectionName: 'Assessment',
          existingContent: 'Patient with acute neurological deficits.',
          transcript: 'The patient suffered an ischemic stroke involving the left MCA territory.',
          noteType: 'progress_note',
          verbosity: 'standard',
        });

      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(true);
      expect(typeof res.body.noteText).toBe('string');
      expect(res.body.noteText.length).toBeGreaterThan(0);
    });

    it('returns ready=false with question and options when AI needs clarification', async () => {
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({
          ready: false,
          question: 'What type of stroke?',
          options: ['Ischemic', 'Hemorrhagic', 'Embolic'],
        }),
      } as any);

      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({
          suggestion: 'Document stroke type (ischemic vs hemorrhagic) and vascular territory',
          sectionName: 'Assessment',
          existingContent: 'Patient with acute neurological deficits.',
          transcript: 'Patient has new neuro deficits.',
          noteType: 'progress_note',
          verbosity: 'standard',
        });

      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(false);
      expect(typeof res.body.question).toBe('string');
      expect(Array.isArray(res.body.options)).toBe(true);
      expect(res.body.options.length).toBe(3);
    });

    it('returns 400 if suggestion is missing', async () => {
      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({ sectionName: 'Assessment' });
      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .send({ suggestion: 'x', sectionName: 'Assessment' });
      expect(res.status).toBe(401);
    });

    it('returns 400 if sectionName is missing', async () => {
      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({ suggestion: 'Document stroke type' });
      expect(res.status).toBe(400);
    });

    it('ready=false options do not include generic escape text', async () => {
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({
          ready: false,
          question: 'What artery was involved?',
          options: ['Left MCA', 'Right MCA', 'Basilar artery'],
        }),
      } as any);

      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({
          suggestion: 'Document vascular territory',
          sectionName: 'Assessment',
          transcript: 'Patient with acute stroke symptoms.',
          noteType: 'progress_note',
          verbosity: 'standard',
        });

      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(false);
      expect(res.body.options.length).toBe(3);
      const escapeTerms = ['not yet', 'unknown', 'not determined', 'tbd'];
      res.body.options.forEach((opt: string) => {
        expect(escapeTerms.some(t => opt.toLowerCase().includes(t))).toBe(false);
      });
    });

    it('returns 500 when AI returns non-JSON', async () => {
      mockAiChat.mockResolvedValueOnce({ content: 'Sorry, I cannot help with that.' } as any);

      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({
          suggestion: 'Document stroke type',
          sectionName: 'Assessment',
          transcript: 'Patient has neuro deficits.',
        });

      expect(res.status).toBe(500);
    });

    it('passes through response when AI returns 2 options instead of 3', async () => {
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({
          ready: false,
          question: 'What type of stroke?',
          options: ['Ischemic', 'Hemorrhagic'],
        }),
      } as any);

      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({
          suggestion: 'Document stroke type',
          sectionName: 'Assessment',
          transcript: 'Patient with neuro deficits.',
          noteType: 'progress_note',
          verbosity: 'standard',
        });

      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(false);
      expect(res.body.options).toEqual(['Ischemic', 'Hemorrhagic']);
    });

    it('passes through response when AI returns 4 options (old escape-option habit)', async () => {
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({
          ready: false,
          question: 'What type of stroke?',
          options: ['Ischemic', 'Hemorrhagic', 'Embolic', 'Not yet determined'],
        }),
      } as any);

      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({
          suggestion: 'Document stroke type',
          sectionName: 'Assessment',
          transcript: 'Patient with neuro deficits.',
          noteType: 'progress_note',
          verbosity: 'standard',
        });

      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(false);
      expect(res.body.options.length).toBe(4);
    });

    it('system prompt explicitly forbids transcript artifact commentary in noteText', async () => {
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({ ready: true, noteText: 'Patient has hypertension, managed with lisinopril.' }),
      } as any);

      await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({
          suggestion: 'Document blood pressure management',
          sectionName: 'Assessment',
          transcript: 'Patient on lisinopril. Also mentioned visiting www.FEMA.gov for disaster prep.',
          noteType: 'progress_note',
          verbosity: 'standard',
        });

      expect(mockAiChat).toHaveBeenCalledTimes(1);
      const callArgs = mockAiChat.mock.calls[0][0] as any;
      const systemPrompt: string = callArgs.messages.find((m: any) => m.role === 'system')?.content ?? '';
      expect(systemPrompt).toMatch(/transcription.*artifact|source.*artifact|transcription quality/i);
    });

    it('returns 500 if AI returns empty options array', async () => {
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({
          ready: false,
          question: 'What type of stroke?',
          options: [],
        }),
      } as any);

      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({
          suggestion: 'Document stroke type',
          sectionName: 'Assessment',
          transcript: 'Patient with neuro deficits.',
          noteType: 'progress_note',
          verbosity: 'standard',
        });

      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/no options/i);
    });

    it('system prompt includes ICD-10 terminology instruction', async () => {
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({ ready: true, noteText: 'Essential (primary) hypertension.' }),
      } as any);
      await request(app).post('/api/ai/scribe/resolve-suggestion').set('Cookie', authCookie)
        .send({ suggestion: 'Document BP', sectionName: 'Assessment', transcript: 'HTN.' });
      const sys: string = (mockAiChat.mock.calls[0][0] as any).messages.find((m: any) => m.role === 'system')?.content ?? '';
      expect(sys).toMatch(/ICD-10|icd-10/i);
    });
  });

  describe('PII de-identification', () => {
    it('/generate — calls piiScrubber.scrub with transcript before LLM call', async () => {
      mockScrub.mockResolvedValueOnce({
        scrubbedFields: { transcript: 'Patient is [PERSON_0].' },
        subMap: { '[PERSON_0]': 'John Smith' },
      });
      mockReInject.mockImplementation((text) =>
        text.replace(/\[PERSON_0\]/g, 'John Smith')
      );
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({
          sections: [{ name: 'HPI', content: '[PERSON_0] has chest pain.', confidence: 0.9 }],
        }),
      } as any);

      const res = await request(app)
        .post('/api/ai/scribe/generate')
        .set('Cookie', authCookie)
        .send({
          transcript: 'Patient is John Smith.',
          sections: [{ name: 'HPI' }],
          noteType: 'progress_note',
        });

      expect(res.status).toBe(200);
      expect(mockScrub).toHaveBeenCalledWith(
        expect.objectContaining({ transcript: 'Patient is John Smith.' })
      );
      const userMsg: string =
        (mockAiChat.mock.calls[0][0] as any).messages.find((m: any) => m.role === 'user')?.content ?? '';
      expect(userMsg).toContain('[PERSON_0]');
      expect(userMsg).not.toContain('John Smith');
      expect(res.body.sections[0].content).toContain('John Smith');
    });

    it('/generate — returns 503 when Presidio is unavailable, never calls LLM', async () => {
      mockScrub.mockRejectedValueOnce(new PiiServiceUnavailableError());

      const res = await request(app)
        .post('/api/ai/scribe/generate')
        .set('Cookie', authCookie)
        .send({
          transcript: 'Patient is John Smith.',
          sections: [{ name: 'HPI' }],
          noteType: 'progress_note',
        });

      expect(res.status).toBe(503);
      expect(mockAiChat).not.toHaveBeenCalled();
      expect(res.body.error).toMatch(/PII scrubbing/i);
    });

    it('/ghost-write — scrubs chatAnswer and existingContent, re-injects into ghostWritten', async () => {
      mockScrub.mockResolvedValueOnce({
        scrubbedFields: { chatAnswer: '[PERSON_0] on lisinopril.', existingContent: '' },
        subMap: { '[PERSON_0]': 'John Smith' },
      });
      mockReInject.mockImplementation((text) =>
        text.replace(/\[PERSON_0\]/g, 'John Smith')
      );
      mockAiChat.mockResolvedValueOnce({ content: '[PERSON_0] on lisinopril.' } as any);

      const res = await request(app)
        .post('/api/ai/scribe/ghost-write')
        .set('Cookie', authCookie)
        .send({
          chatAnswer: 'John Smith on lisinopril.',
          destinationSection: 'Assessment',
          existingContent: '',
        });

      expect(res.status).toBe(200);
      expect(mockScrub).toHaveBeenCalledWith(
        expect.objectContaining({ chatAnswer: 'John Smith on lisinopril.' })
      );
      expect(mockReInject).toHaveBeenCalled();
      expect(res.body.ghostWritten).toContain('John Smith');
    });

    it('/ghost-write — returns 503 when Presidio is unavailable', async () => {
      mockScrub.mockRejectedValueOnce(new PiiServiceUnavailableError());

      const res = await request(app)
        .post('/api/ai/scribe/ghost-write')
        .set('Cookie', authCookie)
        .send({
          chatAnswer: 'John Smith on lisinopril.',
          destinationSection: 'Assessment',
        });

      expect(res.status).toBe(503);
      expect(mockAiChat).not.toHaveBeenCalled();
    });

    it('/focused — returns 503 when Presidio is unavailable', async () => {
      mockScrub.mockRejectedValueOnce(new PiiServiceUnavailableError());

      const res = await request(app)
        .post('/api/ai/scribe/focused')
        .set('Cookie', authCookie)
        .send({ sectionName: 'Assessment', content: 'John Smith with HTN.', transcript: '' });

      expect(res.status).toBe(503);
      expect(mockAiChat).not.toHaveBeenCalled();
    });

    it('/focused — scrubs content and transcript, re-injects into analysis', async () => {
      mockScrub.mockResolvedValueOnce({
        scrubbedFields: { content: '[PERSON_0] with HTN.', transcript: '' },
        subMap: { '[PERSON_0]': 'John Smith' },
      });
      mockReInject.mockImplementation((text) =>
        text.replace(/\[PERSON_0\]/g, 'John Smith')
      );
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({
          analysis: '[PERSON_0] has essential hypertension.',
          citations: [],
          suggestions: ['Add medication list.'],
          confidence_breakdown: '',
        }),
      } as any);

      const res = await request(app)
        .post('/api/ai/scribe/focused')
        .set('Cookie', authCookie)
        .send({ sectionName: 'Assessment', content: 'John Smith with HTN.', transcript: '' });

      expect(res.status).toBe(200);
      expect(mockScrub).toHaveBeenCalled();
      expect(res.body.analysis).toContain('John Smith');
    });

    it('/resolve-suggestion — scrubs suggestion/existingContent/transcript, re-injects into noteText', async () => {
      mockScrub.mockResolvedValueOnce({
        scrubbedFields: {
          suggestion: 'Document BP for [PERSON_0].',
          existingContent: '',
          transcript: '',
        },
        subMap: { '[PERSON_0]': 'John Smith' },
      });
      mockReInject.mockImplementation((text) =>
        text.replace(/\[PERSON_0\]/g, 'John Smith')
      );
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({ ready: true, noteText: '[PERSON_0]: BP 140/90.' }),
      } as any);

      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({
          suggestion: 'Document BP for John Smith.',
          sectionName: 'Assessment',
          existingContent: '',
          transcript: '',
        });

      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(true);
      expect(res.body.noteText).toContain('John Smith');
    });

    it('/resolve-suggestion — returns 503 when Presidio is unavailable', async () => {
      mockScrub.mockRejectedValueOnce(new PiiServiceUnavailableError());

      const res = await request(app)
        .post('/api/ai/scribe/resolve-suggestion')
        .set('Cookie', authCookie)
        .send({
          suggestion: 'Document BP for John Smith.',
          sectionName: 'Assessment',
        });

      expect(res.status).toBe(503);
      expect(mockAiChat).not.toHaveBeenCalled();
    });

    it('system prompt includes token-preservation instruction on /generate', async () => {
      mockScrub.mockResolvedValueOnce({ scrubbedFields: { transcript: 'text' }, subMap: {} });
      mockReInject.mockImplementation((text) => text);
      mockAiChat.mockResolvedValueOnce({
        content: JSON.stringify({
          sections: [{ name: 'HPI', content: 'text', confidence: 0.9 }],
        }),
      } as any);

      await request(app)
        .post('/api/ai/scribe/generate')
        .set('Cookie', authCookie)
        .send({ transcript: 'text', sections: [{ name: 'HPI' }], noteType: 'progress_note' });

      const sys: string =
        (mockAiChat.mock.calls[0][0] as any).messages.find((m: any) => m.role === 'system')?.content ?? '';
      expect(sys).toMatch(/privacy-protection token|TOKEN_N|BRACKET_N/i);
    });
  });
});
