/**
 * Note Type Mapping Configuration
 * Maps sandbox-specific note type names to internal note types
 */

export interface NoteTypeMapping {
  sandboxType: string | RegExp;
  internalType: 'h_and_p' | 'progress_note' | 'procedure_note' | 'accept_note' | 'discharge_summary' | 'consult_note';
  priority?: number; // Higher priority = checked first
}

/**
 * Default note type mappings
 * These are common mappings that work for most EHR systems
 */
const defaultMappings: NoteTypeMapping[] = [
  // H&P mappings
  { sandboxType: /^h&p$/i, internalType: 'h_and_p', priority: 10 },
  { sandboxType: /^history and physical$/i, internalType: 'h_and_p', priority: 10 },
  { sandboxType: /history.*physical/i, internalType: 'h_and_p', priority: 9 },
  { sandboxType: /^h & p$/i, internalType: 'h_and_p', priority: 9 },
  
  // Progress note mappings
  { sandboxType: /^progress note$/i, internalType: 'progress_note', priority: 10 },
  { sandboxType: /^progress$/i, internalType: 'progress_note', priority: 9 },
  { sandboxType: /daily.*note/i, internalType: 'progress_note', priority: 8 },
  { sandboxType: /soap.*note/i, internalType: 'progress_note', priority: 8 },
  
  // Discharge summary mappings
  { sandboxType: /^discharge summary$/i, internalType: 'discharge_summary', priority: 10 },
  { sandboxType: /^discharge$/i, internalType: 'discharge_summary', priority: 9 },
  { sandboxType: /discharge.*summary/i, internalType: 'discharge_summary', priority: 9 },
  
  // Consultation mappings
  { sandboxType: /^consultation$/i, internalType: 'consult_note', priority: 10 },
  { sandboxType: /^consult$/i, internalType: 'consult_note', priority: 9 },
  { sandboxType: /consult.*note/i, internalType: 'consult_note', priority: 8 },
  
  // Procedure note mappings
  { sandboxType: /^procedure note$/i, internalType: 'procedure_note', priority: 10 },
  { sandboxType: /^procedure$/i, internalType: 'procedure_note', priority: 9 },
  { sandboxType: /procedure.*note/i, internalType: 'procedure_note', priority: 8 },
  
  // Accept note mappings
  { sandboxType: /^accept note$/i, internalType: 'accept_note', priority: 10 },
  { sandboxType: /^accept$/i, internalType: 'accept_note', priority: 9 },
  { sandboxType: /accept.*note/i, internalType: 'accept_note', priority: 8 },
  { sandboxType: /transfer.*note/i, internalType: 'accept_note', priority: 7 },
];

/**
 * Custom mappings (can be extended per EHR system)
 * Add EHR-specific mappings here
 */
const customMappings: NoteTypeMapping[] = [
  // Oracle Health/Cerner specific mappings can be added here
  // Example:
  // { sandboxType: 'Cerner Progress Note', internalType: 'progress_note', priority: 10 },
];

/**
 * Get all mappings sorted by priority
 */
export function getNoteTypeMappings(): NoteTypeMapping[] {
  return [...defaultMappings, ...customMappings].sort((a, b) => 
    (b.priority || 0) - (a.priority || 0)
  );
}

/**
 * Map sandbox note type to internal note type
 */
export function mapNoteType(sandboxType: string): 'h_and_p' | 'progress_note' | 'procedure_note' | 'accept_note' | 'discharge_summary' | 'consult_note' | null {
  const mappings = getNoteTypeMappings();
  
  for (const mapping of mappings) {
    if (typeof mapping.sandboxType === 'string') {
      // Exact string match
      if (mapping.sandboxType.toLowerCase() === sandboxType.toLowerCase()) {
        return mapping.internalType;
      }
    } else if (mapping.sandboxType instanceof RegExp) {
      // Regex match
      if (mapping.sandboxType.test(sandboxType)) {
        return mapping.internalType;
      }
    }
  }
  
  return null;
}

/**
 * Add custom mapping (for runtime configuration)
 */
export function addCustomMapping(mapping: NoteTypeMapping): void {
  customMappings.push(mapping);
  // Re-sort by priority
  customMappings.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

/**
 * Clear custom mappings
 */
export function clearCustomMappings(): void {
  customMappings.length = 0;
}

