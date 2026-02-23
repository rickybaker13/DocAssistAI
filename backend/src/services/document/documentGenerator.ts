/**
 * Document Generator (Pattern 1: Prompt Chaining)
 * Multi-step pipeline for document generation
 */

import { Template, DocumentRequest } from './templateRouter.js';
import { DocumentTools, PreviousNote } from './documentTools.js';
import { getAIProvider } from '../ai/providerFactory.js';
import { AIMessage } from '../../types/index.js';

export interface DocumentGenerationContext {
  template: Template;
  previousNote?: PreviousNote | null;
  newData?: any;
  ancillaryNotes?: any[];
  patientSummary: any;
  userContext: DocumentRequest['userContext'];
}

export interface GeneratedDocument {
  content: string;
  sections: Record<string, string>;
  metadata: {
    templateId: string;
    noteType: string;
    generatedAt: string;
    author: string;
  };
}

export class DocumentGenerator {
  private tools: DocumentTools;

  constructor() {
    this.tools = new DocumentTools();
  }

  /**
   * Generate document using prompt chaining pipeline
   */
  async generateDocument(request: DocumentRequest, patientSummary: any, template: Template): Promise<GeneratedDocument> {
    // Set patient summary for tools
    this.tools.setPatientSummary(patientSummary);

    // Step 1: Fetch previous note (if progress note)
    let previousNote: PreviousNote | null = null;
    if (request.noteType === 'progress_note' && request.date) {
      const previousNoteResult = await this.tools.fetchPreviousNote('Progress Note', request.date);
      if (previousNoteResult.success && previousNoteResult.data) {
        previousNote = previousNoteResult.data;
      }
    }

    // Step 2: Fetch new objective data
    const currentDate = request.date || new Date().toISOString();
    const startDate = previousNote
      ? previousNote.date
      : new Date(new Date(currentDate).getTime() - 24 * 60 * 60 * 1000).toISOString(); // Last 24 hours if no previous note

    const [labsResult, vitalsResult, imagingResult, microResult] = await Promise.all([
      this.tools.fetchLabs(startDate, currentDate),
      this.tools.fetchVitals(startDate, currentDate),
      this.tools.fetchImaging(startDate, currentDate),
      this.tools.fetchMicrobiology(startDate, currentDate),
    ]);

    const newData = {
      labs: labsResult.success ? labsResult.data : [],
      vitals: vitalsResult.success ? vitalsResult.data : [],
      imaging: imagingResult.success ? imagingResult.data : [],
      microbiology: microResult.success ? microResult.data : [],
    };

    // Step 3: Fetch ancillary service notes
    const ancillaryServices = ['Physical Therapy', 'Speech Therapy', 'Respiratory Therapy', 'Wound Care'];
    const ancillaryNotesResults = await Promise.all(
      ancillaryServices.map(service =>
        this.tools.fetchAncillaryNotes(service, startDate, currentDate)
      )
    );

    const ancillaryNotes = ancillaryNotesResults
      .filter(result => result.success && result.data && result.data.length > 0)
      .map(result => result.data)
      .flat();

    // Step 4: Extract key points from previous note
    const previousNoteKeyPoints = previousNote
      ? await this.extractKeyPoints(previousNote.content)
      : null;

    // Step 5: Integrate data intelligently
    const integratedData = await this.integrateData({
      previousNoteKeyPoints,
      newData,
      ancillaryNotes,
      patientSummary,
    });

    // Step 6: Generate document sections
    const sections = await this.generateSections(request, integratedData, template);

    // Step 7: Assemble final document
    const content = this.assembleDocument(template, sections);

    return {
      content,
      sections,
      metadata: {
        templateId: template.id,
        noteType: request.noteType,
        generatedAt: new Date().toISOString(),
        author: request.userContext.name || request.userContext.role,
      },
    };
  }

  /**
   * Step 4: Extract key points from previous note
   */
  private async extractKeyPoints(noteContent: string): Promise<string> {
    const provider = getAIProvider();
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are a clinical documentation assistant. Extract key clinical points from the previous progress note that should be carried forward.',
      },
      {
        role: 'user',
        content: `Extract key points from this previous progress note that should be included in today's note:\n\n${noteContent}\n\nReturn only the key points that are still relevant.`,
      },
    ];

    try {
      const response = await provider.chat(messages, { temperature: 0.3 });
      return response.content;
    } catch (error) {
      console.warn('Failed to extract key points, using full note:', error);
      return noteContent.substring(0, 1000); // Fallback: use first 1000 chars
    }
  }

  /**
   * Step 5: Integrate data intelligently
   */
  private async integrateData(context: {
    previousNoteKeyPoints: string | null;
    newData: any;
    ancillaryNotes: any[];
    patientSummary: any;
  }): Promise<any> {
    const provider = getAIProvider();
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are a clinical documentation assistant. Integrate patient data intelligently for note generation.',
      },
      {
        role: 'user',
        content: `Integrate the following data for a progress note:

Previous Note Key Points:
${context.previousNoteKeyPoints || 'None'}

New Labs:
${JSON.stringify(context.newData.labs, null, 2)}

New Vitals:
${JSON.stringify(context.newData.vitals, null, 2)}

New Imaging:
${JSON.stringify(context.newData.imaging, null, 2)}

New Microbiology:
${JSON.stringify(context.newData.microbiology, null, 2)}

Ancillary Service Notes:
${JSON.stringify(context.ancillaryNotes, null, 2)}

Provide an integrated summary organized by:
1. Subjective (from previous note and ancillary notes)
2. Objective (new labs, vitals, imaging, micro)
3. Assessment (clinical interpretation)
4. Plan (next steps)`,
      },
    ];

    try {
      const response = await provider.chat(messages, { temperature: 0.4 });
      return JSON.parse(response.content);
    } catch (error) {
      // Fallback: return structured data
      return {
        subjective: context.previousNoteKeyPoints || 'No changes reported.',
        objective: {
          labs: context.newData.labs,
          vitals: context.newData.vitals,
          imaging: context.newData.imaging,
          microbiology: context.newData.microbiology,
        },
        assessment: 'See individual data points above.',
        plan: 'Continue current management.',
      };
    }
  }

  /**
   * Step 6: Generate document sections
   */
  private async generateSections(
    request: DocumentRequest,
    integratedData: any,
    template: Template
  ): Promise<Record<string, string>> {
    const provider = getAIProvider();

    const sections: Record<string, string> = {};

    // Generate each section based on template
    for (const sectionName of template.sections) {
      const messages: AIMessage[] = [
        {
          role: 'system',
          content: `You are a clinical documentation assistant. Generate the "${sectionName}" section for a ${request.noteType} note.`,
        },
        {
          role: 'user',
          content: `Generate the "${sectionName}" section using this integrated data:\n\n${JSON.stringify(integratedData, null, 2)}\n\nBe concise, accurate, and clinically appropriate.`,
        },
      ];

      try {
        const response = await provider.chat(messages, { temperature: 0.5 });
        sections[sectionName] = response.content;
      } catch (error) {
        sections[sectionName] = `[Error generating ${sectionName} section]`;
      }
    }

    return sections;
  }

  /**
   * Step 7: Assemble final document
   */
  private assembleDocument(template: Template, sections: Record<string, string>): string {
    let content = template.structure;

    // Replace placeholders with generated sections
    template.sections.forEach(section => {
      const placeholder = `{${section.toLowerCase().replace(/\s+/g, '_')}}`;
      const sectionContent = sections[section] || `[${section} not generated]`;
      content = content.replace(placeholder, sectionContent);
    });

    // Replace any remaining common placeholders
    content = content.replace(/{date}/g, new Date().toLocaleDateString());
    content = content.replace(/{time}/g, new Date().toLocaleTimeString());

    return content;
  }
}

export const documentGenerator = new DocumentGenerator();

