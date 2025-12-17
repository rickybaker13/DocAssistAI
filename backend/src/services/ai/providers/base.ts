/**
 * Base AI Provider Interface
 * All AI providers must implement this interface
 */

import { AIMessage, AIResponse } from '../../../types';

export interface AIProvider {
  /**
   * Send chat completion request
   */
  chat(messages: AIMessage[], options?: {
    temperature?: number;
    maxTokens?: number;
  }): Promise<AIResponse>;

  /**
   * Get provider name
   */
  getName(): string;

  /**
   * Check if provider is available
   */
  isAvailable(): Promise<boolean>;
}

export abstract class BaseAIProvider implements AIProvider {
  protected name: string;
  protected model: string;

  constructor(name: string, model: string) {
    this.name = name;
    this.model = model;
  }

  abstract chat(messages: AIMessage[], options?: {
    temperature?: number;
    maxTokens?: number;
  }): Promise<AIResponse>;

  getName(): string {
    return this.name;
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Try a simple health check
      const testMessages: AIMessage[] = [
        { role: 'user', content: 'test' }
      ];
      await this.chat(testMessages, { maxTokens: 5 });
      return true;
    } catch {
      return false;
    }
  }
}

