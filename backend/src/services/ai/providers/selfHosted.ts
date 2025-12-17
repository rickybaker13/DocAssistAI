/**
 * Self-Hosted LLM Provider
 * Handles communication with self-hosted LLM (Ollama, vLLM, etc.)
 */

import axios from 'axios';
import { BaseAIProvider } from './base.js';
import { AIMessage, AIResponse } from '../../../types';

export class SelfHostedProvider extends BaseAIProvider {
  private url: string;
  private type: 'ollama' | 'vllm' | 'custom';

  constructor(url: string, model: string, type: 'ollama' | 'vllm' | 'custom' = 'ollama') {
    super('self-hosted', model);
    this.url = url;
    this.type = type;
  }

  async chat(messages: AIMessage[], options?: {
    temperature?: number;
    maxTokens?: number;
  }): Promise<AIResponse> {
    try {
      let endpoint: string;
      let requestBody: any;

      if (this.type === 'ollama') {
        // Ollama API format
        endpoint = `${this.url}/api/chat`;
        requestBody = {
          model: this.model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          options: {
            temperature: options?.temperature ?? 0.7,
            num_predict: options?.maxTokens,
          },
        };
      } else if (this.type === 'vllm') {
        // vLLM OpenAI-compatible API
        endpoint = `${this.url}/v1/chat/completions`;
        requestBody = {
          model: this.model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens,
        };
      } else {
        // Custom - assume OpenAI-compatible
        endpoint = `${this.url}/v1/chat/completions`;
        requestBody = {
          model: this.model,
          messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens,
        };
      }

      const response = await axios.post(endpoint, requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 60000, // 60 second timeout for self-hosted
      });

      let content: string;
      if (this.type === 'ollama') {
        content = response.data.message?.content || '';
      } else {
        const choice = response.data.choices?.[0];
        content = choice?.message?.content || '';
      }

      if (!content) {
        throw new Error('No response from self-hosted LLM');
      }

      return {
        content,
        model: this.model,
        provider: `self-hosted-${this.type}`,
      };
    } catch (error: any) {
      throw new Error(
        `Self-hosted LLM error: ${error.response?.data?.error?.message || error.message}`
      );
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (this.type === 'ollama') {
        // Check Ollama health
        const response = await axios.get(`${this.url}/api/tags`, { timeout: 5000 });
        return response.status === 200;
      } else {
        // For vLLM/custom, try a simple request
        return await super.isAvailable();
      }
    } catch {
      return false;
    }
  }
}

