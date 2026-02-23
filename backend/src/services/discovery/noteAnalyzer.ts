/**
 * Note Analyzer Service
 * AI-powered analysis of note structures and patterns
 */

import { getAIProvider } from '../ai/providerFactory.js';
import { AIMessage } from '../../types/index.js';

export interface NoteStructure {
  sections: string[];
  format: string;
  style: string;
  placeholders: string[];
}

export interface NoteTypePattern {
  type: string;
  commonSections: string[];
  commonFormat: string;
  examples: string[];
  confidence: number;
}

export interface ProviderRolePattern {
  provider: string;
  role?: string;
  service?: string;
  typicalNoteTypes: string[];
  typicalSections: string[];
  confidence: number;
}

export interface StructureAnalysis {
  noteType: string;
  structure: NoteStructure;
  patterns: string[];
  suggestions: string[];
}

export class NoteAnalyzer {
  /**
   * Analyze note structure using AI
   */
  async analyzeNoteStructure(noteContent: string, noteType: string): Promise<StructureAnalysis> {
    const provider = getAIProvider();

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a clinical documentation expert. Analyze the structure of this clinical note and identify:
1. Section headers (e.g., SUBJECTIVE, OBJECTIVE, ASSESSMENT, PLAN, etc.)
2. Document format and style
3. Key patterns and conventions
4. Suggestions for template structure

Return a JSON object with:
- sections: array of section names found
- format: description of document format (e.g., "SOAP", "Narrative", "Structured")
- style: description of writing style
- placeholders: array of placeholder patterns found (e.g., "{subjective}", "{date}")
- patterns: array of patterns identified
- suggestions: array of suggestions for template structure`,
      },
      {
        role: 'user',
        content: `Analyze this ${noteType} note:\n\n${noteContent.substring(0, 2000)}\n\nReturn JSON only, no markdown formatting.`,
      },
    ];

    try {
      const response = await provider.chat(messages, { temperature: 0.2 });
      
      // Parse JSON response
      let analysis: StructureAnalysis;
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          analysis = JSON.parse(response.content);
        }
      } catch (parseError) {
        // Fallback: extract structure manually
        analysis = this.fallbackStructureAnalysis(noteContent, noteType);
      }

      return analysis;
    } catch (error: any) {
      console.error('[Note Analyzer] Error analyzing structure:', error);
      return this.fallbackStructureAnalysis(noteContent, noteType);
    }
  }

  /**
   * Fallback structure analysis
   */
  private fallbackStructureAnalysis(noteContent: string, noteType: string): StructureAnalysis {
    const sections: string[] = [];
    const structure: NoteStructure = {
      sections: [],
      format: 'Unknown',
      style: 'Unknown',
      placeholders: [],
    };

    // Common section patterns
    const sectionPatterns = [
      { pattern: /SUBJECTIVE[:\s]*/i, name: 'Subjective' },
      { pattern: /OBJECTIVE[:\s]*/i, name: 'Objective' },
      { pattern: /ASSESSMENT[:\s]*/i, name: 'Assessment' },
      { pattern: /PLAN[:\s]*/i, name: 'Plan' },
      { pattern: /CHIEF COMPLAINT[:\s]*/i, name: 'Chief Complaint' },
      { pattern: /HISTORY OF PRESENT ILLNESS[:\s]*/i, name: 'History of Present Illness' },
      { pattern: /REVIEW OF SYSTEMS[:\s]*/i, name: 'Review of Systems' },
      { pattern: /PAST MEDICAL HISTORY[:\s]*/i, name: 'Past Medical History' },
      { pattern: /PHYSICAL EXAMINATION[:\s]*/i, name: 'Physical Examination' },
      { pattern: /ASSESSMENT AND PLAN[:\s]*/i, name: 'Assessment and Plan' },
    ];

    for (const { pattern, name } of sectionPatterns) {
      if (pattern.test(noteContent)) {
        sections.push(name);
        structure.sections.push(name);
      }
    }

    // Determine format
    if (sections.includes('Subjective') && sections.includes('Objective') && 
        sections.includes('Assessment') && sections.includes('Plan')) {
      structure.format = 'SOAP';
    } else if (sections.length > 0) {
      structure.format = 'Structured';
    } else {
      structure.format = 'Narrative';
    }

    return {
      noteType,
      structure,
      patterns: [],
      suggestions: [],
    };
  }

  /**
   * Identify note type patterns from multiple notes
   */
  async identifyNoteTypePatterns(
    notes: Array<{ type: string; content: string }>
  ): Promise<NoteTypePattern[]> {
    const provider = getAIProvider();

    // Group notes by type
    const notesByType = new Map<string, string[]>();
    for (const note of notes) {
      const type = note.type || 'Unknown';
      if (!notesByType.has(type)) {
        notesByType.set(type, []);
      }
      notesByType.get(type)!.push(note.content);
    }

    const patterns: NoteTypePattern[] = [];

    for (const [type, contents] of notesByType.entries()) {
      // Use first few notes for analysis
      const sampleContents = contents.slice(0, 3).join('\n\n---\n\n');

      const messages: AIMessage[] = [
        {
          role: 'system',
          content: `You are a clinical documentation expert. Analyze these ${type} notes to identify common patterns:
1. Common sections across all notes
2. Common format/structure
3. Key patterns and conventions

Return JSON with:
- type: the note type
- commonSections: array of sections found in most/all notes
- commonFormat: description of format
- examples: array of example section headers
- confidence: 0-1 confidence score`,
        },
        {
          role: 'user',
          content: `Analyze these ${type} notes:\n\n${sampleContents.substring(0, 3000)}\n\nReturn JSON only.`,
        },
      ];

      try {
        const response = await provider.chat(messages, { temperature: 0.2 });
        
        let pattern: NoteTypePattern;
        try {
          const jsonMatch = response.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            pattern = JSON.parse(jsonMatch[0]);
          } else {
            pattern = JSON.parse(response.content);
          }
        } catch {
          // Fallback
          pattern = {
            type,
            commonSections: [],
            commonFormat: 'Unknown',
            examples: [],
            confidence: 0.5,
          };
        }

        patterns.push(pattern);
      } catch (error: any) {
        console.error(`[Note Analyzer] Error analyzing type ${type}:`, error);
      }
    }

    return patterns;
  }

  /**
   * Identify provider role patterns
   */
  async identifyProviderRolePatterns(
    providers: Array<{ provider: string; role?: string; service?: string; noteTypes: string[]; sampleContent: string }>
  ): Promise<ProviderRolePattern[]> {
    const patterns: ProviderRolePattern[] = [];

    for (const providerInfo of providers) {
      // Analyze based on note types and content
      const typicalNoteTypes = providerInfo.noteTypes;
      const typicalSections: string[] = [];

      // Try to extract sections from sample content
      const sectionPatterns = [
        /SUBJECTIVE[:\s]*/i,
        /OBJECTIVE[:\s]*/i,
        /ASSESSMENT[:\s]*/i,
        /PLAN[:\s]*/i,
      ];

      for (const pattern of sectionPatterns) {
        if (pattern.test(providerInfo.sampleContent)) {
          const sectionName = pattern.source.replace(/[:\s]*/i, '').trim();
          if (!typicalSections.includes(sectionName)) {
            typicalSections.push(sectionName);
          }
        }
      }

      patterns.push({
        provider: providerInfo.provider,
        role: providerInfo.role,
        service: providerInfo.service,
        typicalNoteTypes,
        typicalSections,
        confidence: typicalNoteTypes.length > 0 ? 0.7 : 0.3,
      });
    }

    return patterns;
  }

  /**
   * Suggest note type mappings
   */
  suggestNoteTypeMappings(
    sandboxTypes: string[],
    internalTypes: string[]
  ): Map<string, string> {
    const mappings = new Map<string, string>();

    // Simple fuzzy matching
    for (const sandboxType of sandboxTypes) {
      const sandboxLower = sandboxType.toLowerCase();
      
      // Try exact matches first
      for (const internalType of internalTypes) {
        const internalLower = internalType.toLowerCase().replace(/_/g, ' ');
        if (sandboxLower === internalLower) {
          mappings.set(sandboxType, internalType);
          break;
        }
      }

      // Try partial matches
      if (!mappings.has(sandboxType)) {
        if (sandboxLower.includes('progress')) {
          mappings.set(sandboxType, 'progress_note');
        } else if (sandboxLower.includes('h&p') || sandboxLower.includes('history and physical')) {
          mappings.set(sandboxType, 'h_and_p');
        } else if (sandboxLower.includes('discharge')) {
          mappings.set(sandboxType, 'discharge_summary');
        } else if (sandboxLower.includes('consult')) {
          mappings.set(sandboxType, 'consult_note');
        } else if (sandboxLower.includes('procedure')) {
          mappings.set(sandboxType, 'procedure_note');
        } else if (sandboxLower.includes('accept')) {
          mappings.set(sandboxType, 'accept_note');
        }
      }
    }

    return mappings;
  }
}

export const noteAnalyzer = new NoteAnalyzer();

