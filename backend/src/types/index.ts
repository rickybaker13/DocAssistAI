/**
 * Type definitions for backend services
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model?: string;
  provider?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface ChatRequest {
  messages: AIMessage[];
  patientContext?: string;
  options?: {
    temperature?: number;
    maxTokens?: number;
  };
}

export interface DocumentRequest {
  template: string;
  patientData: string;
  additionalContext?: string;
}

export interface AuditLog {
  timestamp: Date;
  userId?: string;
  patientId?: string;
  action: string;
  endpoint: string;
  ipAddress?: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

export type AIProviderType = 'external' | 'self-hosted';
export type ExternalAIType = 'openai' | 'openrouter';
export type SelfHostedLLMType = 'ollama' | 'vllm' | 'custom';

