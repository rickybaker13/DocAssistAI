/**
 * Note Discovery Service
 * Fetches, normalizes, and analyzes clinical notes from FHIR resources
 */

import { fhirClientService } from '../fhir/fhirClientService';
import { DocumentReference, Communication } from '../../types';

export interface NormalizedNote {
  id: string;
  type: string;
  author: string;
  date: string;
  content: string;
  source: 'DocumentReference' | 'Communication';
  sourceResource: DocumentReference | Communication;
  metadata?: {
    category?: string[];
    status?: string;
    subject?: string;
  };
}

export interface NoteTypeAnalysis {
  type: string;
  count: number;
  sampleNotes: NormalizedNote[];
  providers: string[];
  dateRange: {
    earliest: string;
    latest: string;
  };
}

export interface ProviderTypeAnalysis {
  provider: string;
  role?: string;
  service?: string;
  count: number;
  noteTypes: string[];
}

export interface DiscoveryReport {
  totalNotes: number;
  noteTypes: NoteTypeAnalysis[];
  providerTypes: ProviderTypeAnalysis[];
  dateRange: {
    earliest: string;
    latest: string;
  };
  generatedAt: string;
}

class NoteDiscoveryService {
  /**
   * Discover notes from FHIR resources
   */
  async discoverNotes(patientId: string): Promise<NormalizedNote[]> {
    console.log(`[Note Discovery] Fetching notes for patient: ${patientId}`);

    // Fetch from multiple FHIR resources
    const [documentReferences, communications] = await Promise.all([
      fhirClientService.getDocumentReferences(patientId).catch(err => {
        console.warn('[Note Discovery] Failed to fetch DocumentReferences:', err);
        return [];
      }),
      fhirClientService.getCommunications(patientId).catch(err => {
        console.warn('[Note Discovery] Failed to fetch Communications:', err);
        return [];
      }),
    ]);

    console.log(`[Note Discovery] Found ${documentReferences.length} DocumentReferences, ${communications.length} Communications`);

    // Normalize all notes
    const normalizedNotes: NormalizedNote[] = [];

    // Normalize DocumentReferences
    for (const docRef of documentReferences) {
      const normalized = this.normalizeDocumentReference(docRef);
      if (normalized) {
        normalizedNotes.push(normalized);
      }
    }

    // Normalize Communications
    for (const comm of communications) {
      const normalized = this.normalizeCommunication(comm);
      if (normalized) {
        normalizedNotes.push(normalized);
      }
    }

    console.log(`[Note Discovery] Normalized ${normalizedNotes.length} notes`);
    return normalizedNotes;
  }

  /**
   * Normalize DocumentReference to common note format
   */
  private normalizeDocumentReference(docRef: DocumentReference): NormalizedNote | null {
    try {
      // Extract note type from type.coding or category
      const type = this.extractNoteType(docRef);
      if (!type) {
        console.warn('[Note Discovery] DocumentReference missing type:', docRef.id);
        return null;
      }

      // Extract author
      const author = this.extractAuthor(docRef.author);

      // Extract date
      const date = docRef.date || docRef.indexed || new Date().toISOString();

      // Extract content
      const content = this.extractDocumentReferenceContent(docRef);
      if (!content) {
        console.warn('[Note Discovery] DocumentReference missing content:', docRef.id);
        return null;
      }

      return {
        id: docRef.id || `docref-${Date.now()}`,
        type,
        author,
        date,
        content,
        source: 'DocumentReference',
        sourceResource: docRef,
        metadata: {
          category: docRef.category?.map(c => c.text || c.coding?.[0]?.display || ''),
          status: docRef.status,
          subject: docRef.subject?.reference,
        },
      };
    } catch (error: any) {
      console.error('[Note Discovery] Error normalizing DocumentReference:', error);
      return null;
    }
  }

  /**
   * Normalize Communication to common note format
   */
  private normalizeCommunication(comm: Communication): NormalizedNote | null {
    try {
      // Extract note type from category or payload
      const type = this.extractNoteTypeFromCommunication(comm);
      if (!type) {
        console.warn('[Note Discovery] Communication missing type:', comm.id);
        return null;
      }

      // Extract author
      const author = this.extractAuthor(comm.sender);

      // Extract date
      const date = comm.sent || comm.received || new Date().toISOString();

      // Extract content
      const content = this.extractCommunicationContent(comm);
      if (!content) {
        console.warn('[Note Discovery] Communication missing content:', comm.id);
        return null;
      }

      return {
        id: comm.id || `comm-${Date.now()}`,
        type,
        author,
        date,
        content,
        source: 'Communication',
        sourceResource: comm,
        metadata: {
          category: comm.category?.map(c => c.text || c.coding?.[0]?.display || ''),
          status: comm.status,
          subject: comm.subject?.reference,
        },
      };
    } catch (error: any) {
      console.error('[Note Discovery] Error normalizing Communication:', error);
      return null;
    }
  }

  /**
   * Extract note type from DocumentReference
   */
  private extractNoteType(docRef: DocumentReference): string {
    // Try type.coding first
    if (docRef.type?.coding && docRef.type.coding.length > 0) {
      return docRef.type.coding[0].display || docRef.type.coding[0].code || 'Unknown';
    }

    // Try type.text
    if (docRef.type?.text) {
      return docRef.type.text;
    }

    // Try category
    if (docRef.category && docRef.category.length > 0) {
      const category = docRef.category[0];
      return category.text || category.coding?.[0]?.display || category.coding?.[0]?.code || 'Unknown';
    }

    return 'Unknown';
  }

  /**
   * Extract note type from Communication
   */
  private extractNoteTypeFromCommunication(comm: Communication): string {
    // Try category
    if (comm.category && comm.category.length > 0) {
      const category = comm.category[0];
      return category.text || category.coding?.[0]?.display || category.coding?.[0]?.code || 'Unknown';
    }

    // Try payload content type
    if (comm.payload && comm.payload.length > 0) {
      const payload = comm.payload[0];
      if (payload.contentString) {
        // Try to infer from content
        return this.inferNoteTypeFromContent(payload.contentString);
      }
    }

    return 'Unknown';
  }

  /**
   * Infer note type from content (simple heuristics)
   */
  private inferNoteTypeFromContent(content: string): string {
    const contentUpper = content.toUpperCase();
    
    if (contentUpper.includes('HISTORY AND PHYSICAL') || contentUpper.includes('H&P')) {
      return 'H&P';
    }
    if (contentUpper.includes('PROGRESS NOTE') || contentUpper.includes('PROGRESS')) {
      return 'Progress Note';
    }
    if (contentUpper.includes('DISCHARGE SUMMARY') || contentUpper.includes('DISCHARGE')) {
      return 'Discharge Summary';
    }
    if (contentUpper.includes('CONSULTATION') || contentUpper.includes('CONSULT')) {
      return 'Consultation';
    }
    if (contentUpper.includes('PROCEDURE NOTE') || contentUpper.includes('PROCEDURE')) {
      return 'Procedure Note';
    }
    if (contentUpper.includes('ACCEPT NOTE') || contentUpper.includes('ACCEPT')) {
      return 'Accept Note';
    }
    
    return 'Unknown';
  }

  /**
   * Extract author from reference
   */
  private extractAuthor(authorRef?: any): string {
    if (!authorRef) return 'Unknown';

    // If it's a reference string
    if (typeof authorRef === 'string') {
      return authorRef.split('/').pop() || 'Unknown';
    }

    // If it's a Reference object
    if (authorRef.reference) {
      return authorRef.reference.split('/').pop() || 'Unknown';
    }

    // If it's a Practitioner resource
    if (authorRef.name) {
      const name = authorRef.name;
      if (Array.isArray(name)) {
        const first = name[0];
        return `${first.prefix || ''} ${first.given?.join(' ') || ''} ${first.family || ''}`.trim() || 'Unknown';
      }
      return `${name.prefix || ''} ${name.given?.join(' ') || ''} ${name.family || ''}`.trim() || 'Unknown';
    }

    return 'Unknown';
  }

  /**
   * Extract content from DocumentReference
   */
  private extractDocumentReferenceContent(docRef: DocumentReference): string | null {
    if (!docRef.content || docRef.content.length === 0) {
      return null;
    }

    // Try to get content from attachment
    const content = docRef.content[0];
    if (content.attachment) {
      const attachment = content.attachment;

      // If data is embedded (base64)
      if (attachment.data) {
        try {
          // Decode base64 if needed
          return atob(attachment.data);
        } catch {
          return attachment.data;
        }
      }

      // If URL is provided, we'd need to fetch it (not implemented here)
      if (attachment.url) {
        return `[Content available at: ${attachment.url}]`;
      }

      // Try title as fallback
      if (attachment.title) {
        return attachment.title;
      }
    }

    return null;
  }

  /**
   * Extract content from Communication
   */
  private extractCommunicationContent(comm: Communication): string | null {
    if (!comm.payload || comm.payload.length === 0) {
      return null;
    }

    const payload = comm.payload[0];

    // Try contentString
    if (payload.contentString) {
      return payload.contentString;
    }

    // Try contentAttachment
    if (payload.contentAttachment?.data) {
      try {
        return atob(payload.contentAttachment.data);
      } catch {
        return payload.contentAttachment.data;
      }
    }

    // Try contentReference
    if (payload.contentReference?.reference) {
      return `[Content reference: ${payload.contentReference.reference}]`;
    }

    return null;
  }

  /**
   * Analyze note types
   */
  analyzeNoteTypes(notes: NormalizedNote[]): NoteTypeAnalysis[] {
    const typeMap = new Map<string, NormalizedNote[]>();

    // Group by type
    for (const note of notes) {
      const type = note.type || 'Unknown';
      if (!typeMap.has(type)) {
        typeMap.set(type, []);
      }
      typeMap.get(type)!.push(note);
    }

    // Analyze each type
    const analyses: NoteTypeAnalysis[] = [];

    for (const [type, typeNotes] of typeMap.entries()) {
      const dates = typeNotes.map(n => new Date(n.date).getTime()).filter(d => !isNaN(d));
      const providers = new Set(typeNotes.map(n => n.author));

      analyses.push({
        type,
        count: typeNotes.length,
        sampleNotes: typeNotes.slice(0, 3), // First 3 as samples
        providers: Array.from(providers),
        dateRange: {
          earliest: dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : '',
          latest: dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : '',
        },
      });
    }

    // Sort by count (descending)
    return analyses.sort((a, b) => b.count - a.count);
  }

  /**
   * Analyze provider types
   */
  analyzeProviderTypes(notes: NormalizedNote[]): ProviderTypeAnalysis[] {
    const providerMap = new Map<string, NormalizedNote[]>();

    // Group by provider
    for (const note of notes) {
      const provider = note.author || 'Unknown';
      if (!providerMap.has(provider)) {
        providerMap.set(provider, []);
      }
      providerMap.get(provider)!.push(note);
    }

    // Analyze each provider
    const analyses: ProviderTypeAnalysis[] = [];

    for (const [provider, providerNotes] of providerMap.entries()) {
      const noteTypes = new Set(providerNotes.map(n => n.type));
      
      // Try to extract role/service from provider name
      const { role, service } = this.parseProviderInfo(provider);

      analyses.push({
        provider,
        role,
        service,
        count: providerNotes.length,
        noteTypes: Array.from(noteTypes),
      });
    }

    // Sort by count (descending)
    return analyses.sort((a, b) => b.count - a.count);
  }

  /**
   * Parse provider info to extract role and service
   */
  private parseProviderInfo(provider: string): { role?: string; service?: string } {
    const providerLower = provider.toLowerCase();

    // Detect role
    let role: string | undefined;
    if (providerLower.includes('dr.') || providerLower.includes('doctor') || providerLower.includes('md')) {
      role = 'MD';
    } else if (providerLower.includes('np') || providerLower.includes('nurse practitioner')) {
      role = 'NP';
    } else if (providerLower.includes('pa') || providerLower.includes('physician assistant')) {
      role = 'PA';
    } else if (providerLower.includes('rn') || providerLower.includes('nurse')) {
      role = 'RN';
    } else if (providerLower.includes('pt') || providerLower.includes('physical therapy')) {
      role = 'PT';
    } else if (providerLower.includes('st') || providerLower.includes('speech therapy')) {
      role = 'ST';
    } else if (providerLower.includes('rt') || providerLower.includes('respiratory therapy')) {
      role = 'RT';
    }

    // Detect service
    let service: string | undefined;
    const servicePatterns = [
      'internal medicine', 'cardiology', 'neurology', 'infectious disease',
      'physical therapy', 'speech therapy', 'respiratory therapy',
      'wound care', 'palliative care', 'chaplain services', 'critical care'
    ];
    for (const pattern of servicePatterns) {
      if (providerLower.includes(pattern)) {
        service = pattern.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        break;
      }
    }

    return { role, service };
  }

  /**
   * Generate comprehensive discovery report
   */
  generateDiscoveryReport(notes: NormalizedNote[]): DiscoveryReport {
    const noteTypes = this.analyzeNoteTypes(notes);
    const providerTypes = this.analyzeProviderTypes(notes);

    const dates = notes.map(n => new Date(n.date).getTime()).filter(d => !isNaN(d));

    return {
      totalNotes: notes.length,
      noteTypes,
      providerTypes,
      dateRange: {
        earliest: dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : '',
        latest: dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : '',
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

export const noteDiscoveryService = new NoteDiscoveryService();

