/**
 * Template Learner (Pattern 9: Learning & Adaptation)
 * Analyzes existing notes to discover templates and adapt to EHR structure
 */

import { getAIProvider } from '../ai/providerFactory.js';
import { AIMessage } from '../../types/index.js';
import { Template, UserContext } from './templateRouter.js';
import { mapNoteType } from '../../config/noteTypeMapping.js';

export interface ClinicalNote {
  id: string;
  type: string;
  author: string;
  date: string;
  content: string;
}

export interface DiscoveredTemplate {
  id: string;
  name: string;
  noteType: string;
  role: UserContext['role'][];
  service?: string;
  provider?: string;
  sections: string[];
  structure: string;
  confidence: number; // 0-1, how confident we are in this template
  sourceNotes: string[]; // IDs of notes used to build this template
  discoveredAt: string;
}

export interface TemplateAnalysis {
  sections: string[];
  structure: string;
  role: UserContext['role'];
  service?: string;
  provider?: string;
}

export class TemplateLearner {
  private learnedTemplates: Map<string, DiscoveredTemplate> = new Map();

  /**
   * Learn templates from existing clinical notes
   */
  async learnFromNotes(notes: ClinicalNote[]): Promise<DiscoveredTemplate[]> {
    console.log(`[Template Learner] Learning from ${notes.length} notes...`);

    // Group notes by type, role, and service
    const noteGroups = this.groupNotes(notes);

    const discoveredTemplates: DiscoveredTemplate[] = [];

    // Analyze each group
    for (const [key, groupNotes] of noteGroups.entries()) {
      if (groupNotes.length === 0) continue;

      console.log(`[Template Learner] Analyzing group: ${key} (${groupNotes.length} notes)`);

      try {
        // Analyze structure from multiple notes in this group
        const analysis = await this.analyzeNoteGroup(groupNotes);

        if (analysis) {
          const template = this.buildTemplateFromAnalysis(key, groupNotes, analysis);
          discoveredTemplates.push(template);
          this.learnedTemplates.set(template.id, template);
        }
      } catch (error: any) {
        console.error(`[Template Learner] Error analyzing group ${key}:`, error.message);
      }
    }

    console.log(`[Template Learner] Discovered ${discoveredTemplates.length} templates`);
    return discoveredTemplates;
  }

  /**
   * Group notes by type, role, and service for analysis
   */
  private groupNotes(notes: ClinicalNote[]): Map<string, ClinicalNote[]> {
    const groups = new Map<string, ClinicalNote[]>();

    for (const note of notes) {
      // Extract role and service from author
      const { role, service, provider } = this.parseAuthor(note.author);

      // Normalize note type
      const noteType = this.normalizeNoteType(note.type);

      // Create group key
      const key = `${noteType}|${role}|${service || 'generic'}|${provider || 'generic'}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(note);
    }

    return groups;
  }

  /**
   * Parse author string to extract role, service, and provider
   */
  private parseAuthor(author: string): {
    role: UserContext['role'];
    service?: string;
    provider?: string;
  } {
    const authorLower = author.toLowerCase();

    // Detect role
    let role: UserContext['role'] = 'OTHER';
    if (authorLower.includes('dr.') || authorLower.includes('doctor') || authorLower.includes('md')) {
      role = 'MD';
    } else if (authorLower.includes('np') || authorLower.includes('nurse practitioner')) {
      role = 'NP';
    } else if (authorLower.includes('pa') || authorLower.includes('physician assistant')) {
      role = 'PA';
    } else if (authorLower.includes('rn') || authorLower.includes('nurse')) {
      role = 'RN';
    } else if (authorLower.includes('pt') || authorLower.includes('physical therapy') || authorLower.includes('physical therapist')) {
      role = 'PT';
    } else if (authorLower.includes('st') || authorLower.includes('speech therapy') || authorLower.includes('speech therapist')) {
      role = 'ST';
    } else if (authorLower.includes('rt') || authorLower.includes('respiratory therapy') || authorLower.includes('respiratory therapist')) {
      role = 'RT';
    } else if (authorLower.includes('wound care') || authorLower.includes('wc')) {
      role = 'WC';
    } else if (authorLower.includes('palliative') || authorLower.includes('pc')) {
      role = 'PC';
    } else if (authorLower.includes('chaplain') || authorLower.includes('ch')) {
      role = 'CH';
    }

    // Extract service
    let service: string | undefined;
    const servicePatterns = [
      'internal medicine', 'cardiology', 'neurology', 'infectious disease',
      'physical therapy', 'speech therapy', 'respiratory therapy',
      'wound care', 'palliative care', 'chaplain services'
    ];
    for (const pattern of servicePatterns) {
      if (authorLower.includes(pattern)) {
        service = pattern.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        break;
      }
    }

    // Extract provider name
    let provider: string | undefined;
    const nameMatch = author.match(/(?:Dr\.|NP|PA|RN|PT|ST|RT)\s+([A-Z][a-z]+)/);
    if (nameMatch) {
      provider = nameMatch[0];
    }

    return { role, service, provider };
  }

  /**
   * Normalize note type
   * Uses note type mapping configuration for flexible matching
   */
  private normalizeNoteType(type: string): string {
    // Try mapping configuration first
    try {
      const mappedType = mapNoteType(type);
      if (mappedType) {
        return mappedType;
      }
    } catch (error) {
      // If mapping config fails, fall back to simple matching
      console.warn('[Template Learner] Note type mapping failed, using fallback:', error);
    }

    // Fallback to simple pattern matching
    const typeLower = type.toLowerCase();
    if (typeLower.includes('h&p') || typeLower.includes('history and physical')) {
      return 'h_and_p';
    } else if (typeLower.includes('progress')) {
      return 'progress_note';
    } else if (typeLower.includes('procedure')) {
      return 'procedure_note';
    } else if (typeLower.includes('accept')) {
      return 'accept_note';
    } else if (typeLower.includes('discharge')) {
      return 'discharge_summary';
    } else if (typeLower.includes('consult')) {
      return 'consult_note';
    }
    return 'progress_note'; // Default
  }

  /**
   * Analyze a group of notes to extract template structure
   */
  private async analyzeNoteGroup(notes: ClinicalNote[]): Promise<TemplateAnalysis | null> {
    if (notes.length === 0) return null;

    const provider = getAIProvider();

    // Use first few notes for analysis (to avoid token limits)
    const sampleNotes = notes.slice(0, Math.min(5, notes.length));
    const notesText = sampleNotes.map((note, idx) => 
      `=== Note ${idx + 1} ===\nAuthor: ${note.author}\nType: ${note.type}\n\n${note.content}\n`
    ).join('\n');

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a clinical documentation expert. Analyze the structure and content patterns of these clinical notes to identify:
1. Section headers (e.g., SUBJECTIVE, OBJECTIVE, ASSESSMENT, PLAN, etc.)
2. Overall document structure and format
3. Role-specific content patterns (what makes a PT note different from an MD note)
4. Service-specific patterns

Return a JSON object with:
- sections: array of section names found (e.g., ["Subjective", "Objective", "Assessment", "Plan"])
- structure: the template structure with placeholders like {subjective}, {objective}, etc.
- role: the primary role (MD, NP, PA, RN, PT, ST, RT, WC, PC, CH, OTHER)
- service: the service name if identifiable (e.g., "Physical Therapy", "Cardiology")
- provider: provider name if identifiable

Be precise and identify ALL sections present in the notes.`,
      },
      {
        role: 'user',
        content: `Analyze these clinical notes:\n\n${notesText}\n\nReturn JSON only, no markdown formatting.`,
      },
    ];

    try {
      const response = await provider.chat(messages, { temperature: 0.2 });
      
      // Parse JSON response
      let analysis: TemplateAnalysis;
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
        } else {
          analysis = JSON.parse(response.content);
        }
      } catch (parseError) {
        // Fallback: try to extract structure manually
        analysis = this.fallbackAnalysis(sampleNotes[0]);
      }

      return analysis;
    } catch (error: any) {
      console.error('[Template Learner] Error analyzing notes:', error);
      // Fallback to manual analysis
      return this.fallbackAnalysis(sampleNotes[0]);
    }
  }

  /**
   * Fallback analysis when AI fails
   */
  private fallbackAnalysis(note: ClinicalNote): TemplateAnalysis {
    const content = note.content;
    const sections: string[] = [];
    const structure: string[] = [];

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

    let lastIndex = 0;
    const foundSections: Array<{ name: string; index: number }> = [];

    for (const { pattern, name } of sectionPatterns) {
      const match = content.match(pattern);
      if (match && match.index !== undefined) {
        foundSections.push({ name, index: match.index });
      }
    }

    foundSections.sort((a, b) => a.index - b.index);

    // Build structure
    for (let i = 0; i < foundSections.length; i++) {
      const section = foundSections[i];
      sections.push(section.name);
      
      const nextIndex = i < foundSections.length - 1 
        ? foundSections[i + 1].index 
        : content.length;
      
      const placeholder = `{${section.name.toLowerCase().replace(/\s+/g, '_')}}`;
      structure.push(`${section.name.toUpperCase()}:\n${placeholder}`);
    }

    const { role, service, provider } = this.parseAuthor(note.author);

    return {
      sections,
      structure: structure.join('\n\n'),
      role,
      service,
      provider,
    };
  }

  /**
   * Build template from analysis
   */
  private buildTemplateFromAnalysis(
    key: string,
    notes: ClinicalNote[],
    analysis: TemplateAnalysis
  ): DiscoveredTemplate {
    const [noteType, role, service, provider] = key.split('|');
    
    const templateId = `learned-${noteType}-${role}-${service || 'generic'}-${Date.now()}`;
    const templateName = `${analysis.service || role} ${this.formatNoteType(noteType)} Template (Learned)`;

    // Calculate confidence based on number of notes and consistency
    const confidence = Math.min(0.9, 0.5 + (notes.length * 0.1));

    return {
      id: templateId,
      name: templateName,
      noteType: noteType as any,
      role: [analysis.role],
      service: analysis.service,
      provider: analysis.provider,
      sections: analysis.sections,
      structure: analysis.structure,
      confidence,
      sourceNotes: notes.map(n => n.id),
      discoveredAt: new Date().toISOString(),
    };
  }

  /**
   * Format note type for display
   */
  private formatNoteType(noteType: string): string {
    return noteType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get learned templates
   */
  getLearnedTemplates(): DiscoveredTemplate[] {
    return Array.from(this.learnedTemplates.values());
  }

  /**
   * Get learned template by ID
   */
  getLearnedTemplate(id: string): DiscoveredTemplate | undefined {
    return this.learnedTemplates.get(id);
  }

  /**
   * Clear learned templates
   */
  clearLearnedTemplates(): void {
    this.learnedTemplates.clear();
  }

  /**
   * Convert discovered template to router template
   */
  toRouterTemplate(discovered: DiscoveredTemplate): Template {
    return {
      id: discovered.id,
      name: discovered.name,
      noteType: discovered.noteType as any,
      role: discovered.role,
      service: discovered.service,
      provider: discovered.provider,
      sections: discovered.sections,
      structure: discovered.structure,
    };
  }
}

export const templateLearner = new TemplateLearner();

