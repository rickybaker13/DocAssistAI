/**
 * AI Provider Configuration
 * Loads and validates AI provider settings
 */

import dotenv from 'dotenv';

dotenv.config();

export interface AIConfig {
  provider: 'external' | 'self-hosted';
  external?: {
    type: 'openai' | 'openrouter' | 'anthropic';
    openai?: {
      apiKey: string;
      model: string;
    };
    openrouter?: {
      apiKey: string;
      model: string;
    };
    anthropic?: {
      apiKey: string;
      model: string;
    };
  };
  selfHosted?: {
    type: 'ollama' | 'vllm' | 'custom';
    url: string;
    model: string;
  };
}

export const aiConfig: AIConfig = {
  provider: (process.env.AI_PROVIDER || 'external') as 'external' | 'self-hosted',
  external: {
    type: (process.env.EXTERNAL_AI_TYPE || 'anthropic') as 'openai' | 'openrouter' | 'anthropic',
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4',
    },
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: process.env.OPENROUTER_MODEL || 'openrouter/auto',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    },
  },
  selfHosted: {
    type: (process.env.SELF_HOSTED_LLM_TYPE || 'ollama') as 'ollama' | 'vllm' | 'custom',
    url: process.env.SELF_HOSTED_LLM_URL || 'http://localhost:11434',
    model: process.env.SELF_HOSTED_LLM_MODEL || 'llama2',
  },
};

/**
 * Validate AI configuration
 */
export function validateAIConfig(): { valid: boolean; error?: string } {
  if (aiConfig.provider === 'external') {
    if (!aiConfig.external) {
      return { valid: false, error: 'External AI config missing' };
    }
    
    if (aiConfig.external.type === 'openai') {
      if (!aiConfig.external.openai?.apiKey) {
        return { valid: false, error: 'OpenAI API key not configured' };
      }
    } else if (aiConfig.external.type === 'openrouter') {
      if (!aiConfig.external.openrouter?.apiKey) {
        return { valid: false, error: 'OpenRouter API key not configured' };
      }
    } else if (aiConfig.external.type === 'anthropic') {
      if (!aiConfig.external.anthropic?.apiKey) {
        return { valid: false, error: 'Anthropic API key not configured' };
      }
    }
  } else if (aiConfig.provider === 'self-hosted') {
    if (!aiConfig.selfHosted?.url || !aiConfig.selfHosted?.model) {
      return { valid: false, error: 'Self-hosted LLM config incomplete' };
    }
  }
  
  return { valid: true };
}

