/**
 * AI Provider Factory
 * Creates appropriate AI provider based on configuration
 */

import { aiConfig } from '../../config/aiConfig.js';
import { OpenAIProvider } from './providers/openai.js';
import { OpenRouterProvider } from './providers/openrouter.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { SelfHostedProvider } from './providers/selfHosted.js';
import { AIProvider } from './providers/base.js';

let cachedProvider: AIProvider | null = null;

/**
 * Create AI provider based on configuration
 */
export function createAIProvider(): AIProvider {
  // Return cached provider if exists
  if (cachedProvider) {
    return cachedProvider;
  }

  if (aiConfig.provider === 'external') {
    if (!aiConfig.external) {
      throw new Error('External AI configuration missing');
    }

    if (aiConfig.external.type === 'openai') {
      if (!aiConfig.external.openai?.apiKey) {
        throw new Error('OpenAI API key not configured');
      }
      cachedProvider = new OpenAIProvider(
        aiConfig.external.openai.apiKey,
        aiConfig.external.openai.model
      );
    } else if (aiConfig.external.type === 'openrouter') {
      if (!aiConfig.external.openrouter?.apiKey) {
        throw new Error('OpenRouter API key not configured');
      }
      cachedProvider = new OpenRouterProvider(
        aiConfig.external.openrouter.apiKey,
        aiConfig.external.openrouter.model
      );
    } else if (aiConfig.external.type === 'anthropic') {
      if (!aiConfig.external.anthropic?.apiKey) {
        throw new Error('Anthropic API key not configured');
      }
      cachedProvider = new AnthropicProvider(
        aiConfig.external.anthropic.apiKey,
        aiConfig.external.anthropic.model
      );
    } else {
      throw new Error(`Unknown external AI type: ${aiConfig.external.type}`);
    }
  } else if (aiConfig.provider === 'self-hosted') {
    if (!aiConfig.selfHosted) {
      throw new Error('Self-hosted LLM configuration missing');
    }
    cachedProvider = new SelfHostedProvider(
      aiConfig.selfHosted.url,
      aiConfig.selfHosted.model,
      aiConfig.selfHosted.type
    );
  } else {
    throw new Error(`Unknown AI provider: ${aiConfig.provider}`);
  }

  return cachedProvider;
}

/**
 * Get current provider instance
 */
export function getAIProvider(): AIProvider {
  if (!cachedProvider) {
    return createAIProvider();
  }
  return cachedProvider;
}

/**
 * Reset provider cache (useful for testing or config changes)
 */
export function resetProviderCache(): void {
  cachedProvider = null;
}

