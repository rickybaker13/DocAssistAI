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
  redirectUri: import.meta.env.VITE_REDIRECT_URI || 'http://localhost:8080/redirect.html',
  
  // Backend Configuration
  // In production (Vite build), Vercel proxies /api/* → Railway so we use relative paths.
  // In local dev (Vite dev server), fall back to localhost:3000.
  backendUrl: import.meta.env.PROD ? '' : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'),
  
  // AI Configuration (deprecated - now handled by backend)
  // Kept for backward compatibility during migration
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
 * Get backend API URL
 */
export const getBackendUrl = (): string => {
  return appConfig.backendUrl;
};

// Deprecated functions - kept for backward compatibility
// AI configuration is now handled by backend
export const getAIApiKey = (): string => {
  console.warn('getAIApiKey() is deprecated - AI is now handled by backend');
  if (appConfig.aiProvider === 'openai') {
    return appConfig.openaiApiKey;
  }
  return appConfig.openrouterApiKey;
};

export const getAIModel = (): string => {
  console.warn('getAIModel() is deprecated - AI is now handled by backend');
  if (appConfig.aiProvider === 'openai') {
    return appConfig.openaiModel;
  }
  return appConfig.openrouterModel;
};

export const getAIEndpoint = (): string => {
  console.warn('getAIEndpoint() is deprecated - AI is now handled by backend');
  return `${appConfig.backendUrl}/api/ai/chat`;
};

