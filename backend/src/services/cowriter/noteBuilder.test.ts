import { buildCoWriterPrompt, NOTE_SECTION_PROMPTS } from './noteBuilder';

describe('noteBuilder', () => {
  it('returns all required sections for Progress Note', () => {
    const sections = NOTE_SECTION_PROMPTS['Progress Note'];
    expect(sections).toEqual(['Subjective', 'Objective', 'Assessment', 'Plan']);
  });

  it('buildCoWriterPrompt includes note type and sections', () => {
    const prompt = buildCoWriterPrompt('Progress Note', 'Some chart data');
    expect(prompt).toContain('Progress Note');
    expect(prompt).toContain('Subjective');
    expect(prompt).toContain('Plan');
    expect(prompt).toContain('Some chart data');
  });

  it('buildCoWriterPrompt includes additional context when provided', () => {
    const prompt = buildCoWriterPrompt('Progress Note', 'chart data', 'Patient is febrile');
    expect(prompt).toContain('Patient is febrile');
  });

  it('falls back to Progress Note sections for unknown note types', () => {
    const prompt = buildCoWriterPrompt('Unknown Type', 'chart');
    expect(prompt).toContain('Subjective');
  });
});
