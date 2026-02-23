/**
 * Vector Store
 * Simple in-memory vector store for RAG
 * Stores embeddings with metadata for semantic search
 */

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    type: 'condition' | 'medication' | 'lab' | 'vital' | 'imaging' | 'procedure' | 'note' | 'encounter' | 'allergy' | 'io';
    resourceId?: string;
    date?: string;
    category?: string;
    [key: string]: any;
  };
}

export class VectorStore {
  private documents: VectorDocument[] = [];

  /**
   * Add document to vector store
   */
  addDocument(doc: VectorDocument): void {
    this.documents.push(doc);
  }

  /**
   * Add multiple documents
   */
  addDocuments(docs: VectorDocument[]): void {
    this.documents.push(...docs);
  }

  /**
   * Clear all documents
   */
  clear(): void {
    this.documents = [];
  }

  /**
   * Get all documents
   */
  getAllDocuments(): VectorDocument[] {
    return this.documents;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  /**
   * Search for similar documents using cosine similarity
   * Returns top K most similar documents
   */
  search(queryEmbedding: number[], topK: number = 5, minScore: number = 0.5): VectorDocument[] {
    const results = this.documents
      .map(doc => ({
        doc,
        score: this.cosineSimilarity(queryEmbedding, doc.embedding),
      }))
      .filter(result => result.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(result => result.doc);

    return results;
  }

  /**
   * Get document count
   */
  getDocumentCount(): number {
    return this.documents.length;
  }

  /**
   * Remove documents by type
   */
  removeByType(type: string): void {
    this.documents = this.documents.filter(doc => doc.metadata.type !== type);
  }

  /**
   * Remove document by ID
   */
  removeById(id: string): void {
    this.documents = this.documents.filter(doc => doc.id !== id);
  }
}

// Singleton instance
export const vectorStore = new VectorStore();

