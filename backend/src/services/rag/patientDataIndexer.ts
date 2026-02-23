/**
 * Patient Data Indexer
 * Indexes patient data into vector store for RAG
 */

import { PatientSummary } from '../../types/index.js';
import { VectorDocument, vectorStore } from './vectorStore.js';
import { embeddingService } from './embeddingService.js';

export class PatientDataIndexer {
  /**
   * Index patient summary data into vector store
   */
  async indexPatientData(patientSummary: PatientSummary): Promise<void> {
    if (!embeddingService.isAvailable()) {
      console.warn('Embedding service not available. RAG will not work.');
      return;
    }

    // Clear existing data for this patient
    vectorStore.clear();

    const documents: VectorDocument[] = [];

    // Index patient demographics
    const patientName = patientSummary.patient.name?.[0]?.given?.join(' ') + ' ' + 
                       patientSummary.patient.name?.[0]?.family || 'Unknown';
    const patientText = `Patient: ${patientName}, MRN: ${patientSummary.patient.identifier?.[0]?.value || 'Unknown'}, DOB: ${patientSummary.patient.birthDate || 'Unknown'}, Gender: ${patientSummary.patient.gender || 'Unknown'}`;
    documents.push({
      id: 'patient-demographics',
      content: patientText,
      embedding: [], // Will be filled after embedding generation
      metadata: { type: 'encounter' },
    });

    // Index conditions
    (patientSummary.conditions || []).forEach((condition, idx) => {
      const conditionText = `Condition: ${condition.code?.text || 'Unknown'}, Status: ${condition.clinicalStatus?.coding?.[0]?.display || 'Unknown'}, Onset: ${condition.onsetDateTime || 'Unknown'}`;
      documents.push({
        id: `condition-${condition.id || idx}`,
        content: conditionText,
        embedding: [],
        metadata: {
          type: 'condition',
          resourceId: condition.id,
          date: condition.onsetDateTime,
          condition: condition.code?.text,
        },
      });
    });

    // Index medications
    (patientSummary.medications || []).forEach((med, idx) => {
      let medText = `Medication: ${med.medicationCodeableConcept?.text || 'Unknown'}, Status: ${med.status || 'Unknown'}`;
      const dosage = med.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity;
      if (dosage) {
        medText += `, Dosage: ${dosage.value} ${dosage.unit || ''}`;
      }
      documents.push({
        id: `medication-${med.id || idx}`,
        content: medText,
        embedding: [],
        metadata: {
          type: 'medication',
          resourceId: med.id,
          medication: med.medicationCodeableConcept?.text,
          status: med.status,
        },
      });
    });

    // Index allergies
    (patientSummary.allergies || []).forEach((allergy, idx) => {
      const allergyText = `Allergy: ${allergy.code?.text || 'Unknown'}, Severity: ${allergy.criticality || 'Unknown'}, Reaction: ${allergy.reaction?.[0]?.manifestation?.[0]?.text || 'Unknown'}`;
      documents.push({
        id: `allergy-${allergy.id || idx}`,
        content: allergyText,
        embedding: [],
        metadata: {
          type: 'allergy',
          resourceId: allergy.id,
          allergen: allergy.code?.text,
          severity: allergy.criticality,
        },
      });
    });

    // Index labs (chunked by date ranges for better retrieval)
    // Support both recentLabs and labResults property names
    const labs = patientSummary.recentLabs || patientSummary.labResults || [];
    if (labs.length > 0) {
      labs.forEach((lab, idx) => {
        const labText = `Lab Result: ${lab.code?.text || 'Unknown'}, Value: ${lab.valueQuantity ? `${lab.valueQuantity.value} ${lab.valueQuantity.unit}` : lab.valueString || 'N/A'}, Date: ${lab.effectiveDateTime || 'Unknown'}`;
        documents.push({
          id: `lab-${lab.id || idx}`,
          content: labText,
          embedding: [],
          metadata: {
            type: 'lab',
            resourceId: lab.id,
            date: lab.effectiveDateTime,
            labName: lab.code?.text,
            value: lab.valueQuantity?.value || lab.valueString,
          },
        });
      });
    }

    // Index vitals (grouped by time periods)
    // Support both recentVitals and vitalSigns property names
    const vitals = patientSummary.recentVitals || patientSummary.vitalSigns || [];
    if (vitals.length > 0) {
      vitals.forEach((vital, idx) => {
        const vitalValue = vital.valueQuantity 
          ? `${vital.valueQuantity.value} ${vital.valueQuantity.unit}`
          : vital.component
          ? `${vital.component[0]?.valueQuantity?.value}/${vital.component[1]?.valueQuantity?.value} ${vital.component[0]?.valueQuantity?.unit}`
          : 'N/A';
        const vitalText = `Vital Sign: ${vital.code?.text || 'Unknown'}, Value: ${vitalValue}, Date: ${vital.effectiveDateTime || 'Unknown'}`;
        documents.push({
          id: `vital-${vital.id || idx}`,
          content: vitalText,
          embedding: [],
          metadata: {
            type: 'vital',
            resourceId: vital.id,
            date: vital.effectiveDateTime,
            vitalName: vital.code?.text,
            value: vitalValue,
          },
        });
      });
    }

    // Index imaging reports
    if (patientSummary.imagingReports) {
      patientSummary.imagingReports.forEach((report, idx) => {
        const reportText = `Imaging Study: ${report.code?.text || 'Unknown'}, Date: ${report.effectiveDateTime || 'Unknown'}, Conclusion: ${report.conclusion || 'No conclusion'}`;
        documents.push({
          id: `imaging-${report.id || idx}`,
          content: reportText,
          embedding: [],
          metadata: {
            type: 'imaging',
            resourceId: report.id,
            date: report.effectiveDateTime,
            studyType: report.code?.text,
          },
        });
      });
    }

    // Index procedures
    if (patientSummary.procedures) {
      patientSummary.procedures.forEach((proc, idx) => {
        const procText = `Procedure: ${proc.code?.text || 'Unknown'}, Date: ${proc.performedDateTime || 'Unknown'}, Status: ${proc.status || 'Unknown'}`;
        documents.push({
          id: `procedure-${proc.id || idx}`,
          content: procText,
          embedding: [],
          metadata: {
            type: 'procedure',
            resourceId: proc.id,
            date: proc.performedDateTime,
            procedure: proc.code?.text,
          },
        });
      });
    }

    // Index clinical notes (chunked for better retrieval)
    if (patientSummary.clinicalNotes) {
      patientSummary.clinicalNotes.forEach((note, idx) => {
        // Truncate note content if too long (keep first 500 chars for embedding)
        const noteContent = note.content?.substring(0, 500) || '';
        const noteText = `Clinical Note - ${note.type || 'Note'}: ${note.author || 'Unknown'}, Date: ${note.date || 'Unknown'}, Content: ${noteContent}`;
        documents.push({
          id: `note-${note.id || idx}`,
          content: noteText,
          embedding: [],
          metadata: {
            type: 'note',
            resourceId: note.id,
            date: note.date,
            noteType: note.type,
            author: note.author,
          },
        });
      });
    }

    // Index encounters
    // Support both recentEncounters and encounters property names
    const encounters = patientSummary.recentEncounters || patientSummary.encounters || [];
    if (encounters.length > 0) {
      encounters.forEach((encounter, idx) => {
        const encounterText = `Encounter: ${encounter.class?.display || 'Unknown'}, Status: ${encounter.status || 'Unknown'}, Start: ${encounter.period?.start || 'Unknown'}, End: ${encounter.period?.end || 'Ongoing'}`;
        documents.push({
          id: `encounter-${encounter.id || idx}`,
          content: encounterText,
          embedding: [],
          metadata: {
            type: 'encounter',
            resourceId: encounter.id,
            date: encounter.period?.start,
            encounterType: encounter.class?.display,
            status: encounter.status,
          },
        });
      });
    }

    // Index I&O data
    if (patientSummary.fluidIO) {
      patientSummary.fluidIO.forEach((io, idx) => {
        const ioText = `Fluid ${io.code?.text || 'Unknown'}: ${io.valueQuantity ? `${io.valueQuantity.value} ${io.valueQuantity.unit}` : 'N/A'}, Date: ${io.effectiveDateTime || 'Unknown'}`;
        documents.push({
          id: `io-${io.id || idx}`,
          content: ioText,
          embedding: [],
          metadata: {
            type: 'io',
            resourceId: io.id,
            date: io.effectiveDateTime,
            ioType: io.code?.text,
          },
        });
      });
    }

    // Generate embeddings for all documents
    console.log(`[RAG] Indexing ${documents.length} patient data chunks...`);
    const texts = documents.map(doc => doc.content);
    
    try {
      const embeddings = await embeddingService.generateEmbeddings(texts);
      
      // Assign embeddings to documents
      documents.forEach((doc, idx) => {
        doc.embedding = embeddings[idx];
      });

      // Add to vector store
      vectorStore.addDocuments(documents);
      console.log(`[RAG] Successfully indexed ${documents.length} documents`);
    } catch (error: any) {
      console.error('[RAG] Failed to generate embeddings:', error);
      throw error;
    }
  }

  /**
   * Clear patient data from index
   */
  clearIndex(): void {
    vectorStore.clear();
    console.log('[RAG] Cleared patient data index');
  }
}

export const patientDataIndexer = new PatientDataIndexer();

