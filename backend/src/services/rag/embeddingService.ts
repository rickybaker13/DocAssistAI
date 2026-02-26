// @ts-nocheck
/**
 * Embedding Service
 * Generates embeddings for text using OpenAI API
 */

import OpenAI from 'openai';
import { aiConfig } from '../../config/aiConfig.js';

export class EmbeddingService {
  private openai: OpenAI | null = null;
  private model: string = 'text-embedding-3-small'; // Default model
  private useOpenRouter: boolean = false;

  constructor() {
    // Initialize OpenAI client if API key is available
    // Use OpenAI API key (works with both OpenAI and OpenRouter)
    const openaiKey = aiConfig.external?.openai?.apiKey;
    const openrouterKey = aiConfig.external?.openrouter?.apiKey;
    const externalType = aiConfig.external?.type || 'openrouter';
    
    // Prefer OpenRouter if configured, otherwise use OpenAI
    const apiKey = (externalType === 'openrouter' && openrouterKey) 
      ? openrouterKey 
      : (openaiKey || openrouterKey);
    
    if (apiKey && apiKey !== 'your_openai_key_here' && apiKey !== 'your_openrouter_key_here') {
      // Determine base URL based on configured type
      this.useOpenRouter = externalType === 'openrouter' && openrouterKey && openrouterKey !== 'your_openrouter_key_here';
      const baseURL = this.useOpenRouter
        ? 'https://openrouter.ai/api/v1'
        : 'https://api.openai.com/v1';

      // For OpenRouter, use the full model path with provider prefix
      if (this.useOpenRouter) {
        this.model = 'openai/text-embedding-3-small';
      }

      console.log('[Embedding Service] Initializing with:', {
        provider: this.useOpenRouter ? 'OpenRouter' : 'OpenAI',
        baseURL,
        model: this.model,
        hasApiKey: !!apiKey,
      });

      this.openai = new OpenAI({
        apiKey,
        baseURL,
        defaultHeaders: this.useOpenRouter ? {
          'HTTP-Referer': 'https://docassistai.local',
          'X-Title': 'DocAssistAI',
        } : {},
      });
    } else {
      console.warn('[Embedding Service] No valid API key found. RAG will not work.');
    }
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized. Please configure API key.');
    }

    try {
      // Use OpenAI-compatible embedding endpoint
      // For OpenRouter, use OpenAI model names
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error: any) {
      console.error('Embedding generation error:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized. Please configure API key.');
    }

    if (!texts || texts.length === 0) {
      return [];
    }

    try {
      console.log(`[Embedding Service] Generating embeddings for ${texts.length} texts using model: ${this.model}`);
      
      const response = await this.openai.embeddings.create({
        model: this.model,
        input: texts,
      });

      console.log('[Embedding Service] Raw API response:', {
        hasResponse: !!response,
        hasData: !!response?.data,
        dataType: Array.isArray(response?.data) ? 'array' : typeof response?.data,
        dataLength: Array.isArray(response?.data) ? response.data.length : 'N/A',
        responseKeys: response ? Object.keys(response) : [],
      });

      if (!response) {
        console.error('[Embedding Service] No response received');
        throw new Error('No response from embedding API');
      }

      // OpenRouter may return data directly or nested differently
      let data = response.data;
      if (!data && (response as any).data) {
        data = (response as any).data;
      }

      if (!data) {
        console.error('[Embedding Service] No data in response. Full response:', JSON.stringify(response, null, 2));
        throw new Error('No data in embedding API response');
      }

      if (!Array.isArray(data)) {
        console.error('[Embedding Service] Invalid response format. Expected array, got:', typeof data);
        console.error('[Embedding Service] Response structure:', JSON.stringify(response, null, 2));
        throw new Error('Invalid response format from embedding API - expected array');
      }

      if (data.length === 0) {
        console.warn('[Embedding Service] Empty response data array');
        return [];
      }

      const embeddings = data.map((item: any, idx: number) => {
        if (!item) {
          console.error(`[Embedding Service] Invalid embedding item at index ${idx}:`, item);
          throw new Error(`Invalid embedding item at index ${idx}`);
        }
        
        // Handle different response formats
        const embedding = item.embedding || item.data || item;
        
        if (!Array.isArray(embedding)) {
          console.error(`[Embedding Service] Invalid embedding format at index ${idx}:`, item);
          throw new Error(`Invalid embedding format at index ${idx} - expected array`);
        }
        
        return embedding;
      });

      console.log(`[Embedding Service] Successfully generated ${embeddings.length} embeddings`);
      return embeddings;
    } catch (error: any) {
      console.error('[Embedding Service] Batch embedding generation error:', error);
      console.error('[Embedding Service] Error details:', {
        message: error.message,
        status: error.status,
        statusText: error.statusText,
        response: error.response?.data,
        errorType: error.constructor.name,
      });
      
      // Provide more specific error message
      if (error.response?.data) {
        throw new Error(`Failed to generate embeddings: ${JSON.stringify(error.response.data)}`);
      }
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
  }

  /**
   * Check if embedding service is available
   */
  isAvailable(): boolean {
    return this.openai !== null;
  }
}

export const embeddingService = new EmbeddingService();

