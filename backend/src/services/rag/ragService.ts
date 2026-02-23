/**
 * RAG Service
 * Retrieval-Augmented Generation service for intelligent patient data retrieval
 */

import { embeddingService } from './embeddingService.js';
import { vectorStore } from './vectorStore.js';
import { VectorDocument } from './vectorStore.js';

export interface RAGRetrievalResult {
  documents: VectorDocument[];
  retrievedContext: string;
  query: string;
}

export class RAGService {
  /**
   * Retrieve relevant patient data for a query
   */
  async retrieve(query: string, topK: number = 5, minScore: number = 0.5): Promise<RAGRetrievalResult> {
    if (!embeddingService.isAvailable()) {
      throw new Error('Embedding service not available. Cannot perform RAG retrieval.');
    }

    if (vectorStore.getDocumentCount() === 0) {
      throw new Error('No patient data indexed. Please index patient data first.');
    }

    // Generate embedding for query
    const queryEmbedding = await embeddingService.generateEmbedding(query);

    // Search vector store
    const relevantDocs = vectorStore.search(queryEmbedding, topK, minScore);

    // Format retrieved context
    const retrievedContext = this.formatRetrievedContext(relevantDocs, query);

    return {
      documents: relevantDocs,
      retrievedContext,
      query,
    };
  }

  /**
   * Format retrieved documents into context string
   */
  private formatRetrievedContext(documents: VectorDocument[], query: string): string {
    if (documents.length === 0) {
      return 'No relevant patient data found for this query.';
    }

    const sections: string[] = [];
    
    // Group by type for better organization
    const grouped: Record<string, VectorDocument[]> = {};
    documents.forEach(doc => {
      const type = doc.metadata.type || 'other';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(doc);
    });

    // Format each group
    Object.entries(grouped).forEach(([type, docs]) => {
      const typeLabel = this.getTypeLabel(type);
      sections.push(`\n=== ${typeLabel} ===`);
      docs.forEach(doc => {
        sections.push(doc.content);
      });
    });

    return sections.join('\n');
  }

  /**
   * Get human-readable label for document type
   */
  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      condition: 'CONDITIONS',
      medication: 'MEDICATIONS',
      lab: 'LABORATORY RESULTS',
      vital: 'VITAL SIGNS',
      imaging: 'IMAGING STUDIES',
      procedure: 'PROCEDURES',
      note: 'CLINICAL NOTES',
      encounter: 'ENCOUNTERS',
      allergy: 'ALLERGIES',
      io: 'FLUID INTAKE/OUTPUT',
    };
    return labels[type] || type.toUpperCase();
  }

  /**
   * Check if RAG is available
   */
  isAvailable(): boolean {
    return embeddingService.isAvailable() && vectorStore.getDocumentCount() > 0;
  }

  /**
   * Get index statistics
   */
  getIndexStats(): {
    documentCount: number;
    available: boolean;
  } {
    return {
      documentCount: vectorStore.getDocumentCount(),
      available: this.isAvailable(),
    };
  }
}

export const ragService = new RAGService();

