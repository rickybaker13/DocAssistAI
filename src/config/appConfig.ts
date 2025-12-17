/**
 * Application Configuration
 * Loads environment variables and provides app-wide configuration
 */

export const appConfig = {
  // Oracle Health Configuration
  tenantId: import.meta.env.VITE_TENANT_ID || '',
  fhirBaseUrl: import.meta.env.VITE_FHIR_BASE_URL || '',
  authBaseUrl: import.meta.env.VITE_AUTH_BASE_URL || 'https://authorization.cerner.com',
  clientId: import.meta.env.VITE_CLIENT_ID || '',
  redirectUri: import.meta.env.VITE_REDIRECT_URI || 'http://localhost:8080/redirect',
  
  // AI Configuration
  aiProvider: (import.meta.env.VITE_AI_PROVIDER || 'openrouter') as 'openai' | 'openrouter',
  openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  openaiModel: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4',
  openrouterApiKey: import.meta.env.VITE_OPENROUTER_API_KEY || '',
  openrouterModel: import.meta.env.VITE_OPENROUTER_MODEL || 'openai/gpt-4-turbo-preview',
  
  // App Info
  appName: import.meta.env.VITE_APP_NAME || 'DocAssistAI',
  appId: import.meta.env.VITE_APP_ID || '',
} as const;

/**
 * Get the active AI API key based on provider
 */
export const getAIApiKey = (): string => {
  if (appConfig.aiProvider === 'openai') {
    return appConfig.openaiApiKey;
  }
  return appConfig.openrouterApiKey;
};

/**
 * Get the active AI model based on provider
 */
export const getAIModel = (): string => {
  if (appConfig.aiProvider === 'openai') {
    return appConfig.openaiModel;
  }
  return appConfig.openrouterModel;
};

/**
 * Get the AI API endpoint based on provider
 */
export const getAIEndpoint = (): string => {
  if (appConfig.aiProvider === 'openai') {
    return 'https://api.openai.com/v1/chat/completions';
  }
  return 'https://openrouter.ai/api/v1/chat/completions';
};

