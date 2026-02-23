/**
 * Token Counter Utility
 * Estimates token counts for text (useful for debugging and cost tracking)
 * 
 * Note: This is an approximation. Actual tokenization varies by model.
 * Rough estimate: 1 token ≈ 4 characters for English text
 */

/**
 * Estimate token count for text
 * Uses a rough approximation: ~4 characters per token for English text
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  
  // Rough approximation: 1 token ≈ 4 characters for English
  // More accurate: count words and add punctuation
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  const punctuation = (text.match(/[.,!?;:]/g) || []).length;
  const specialChars = (text.match(/[{}[\]()<>]/g) || []).length;
  
  // Average: 1.3 tokens per word, 0.5 tokens per punctuation mark
  return Math.ceil(words * 1.3 + punctuation * 0.5 + specialChars * 0.3);
}

/**
 * Count tokens in messages array
 */
export function countMessageTokens(messages: Array<{ role: string; content: string }>): number {
  return messages.reduce((total, msg) => {
    return total + estimateTokens(msg.content || '');
  }, 0);
}

/**
 * Format token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return `${tokens} tokens`;
  }
  return `${(tokens / 1000).toFixed(1)}k tokens`;
}

/**
 * Analyze message structure and token distribution
 */
export function analyzeMessages(messages: Array<{ role: string; content: string }>): {
  totalTokens: number;
  byRole: { [role: string]: number };
  messageCounts: { [role: string]: number };
} {
  const byRole: { [role: string]: number } = {};
  const messageCounts: { [role: string]: number } = {};
  
  messages.forEach(msg => {
    const role = msg.role || 'unknown';
    const tokens = estimateTokens(msg.content || '');
    
    byRole[role] = (byRole[role] || 0) + tokens;
    messageCounts[role] = (messageCounts[role] || 0) + 1;
  });
  
  return {
    totalTokens: countMessageTokens(messages),
    byRole,
    messageCounts,
  };
}

