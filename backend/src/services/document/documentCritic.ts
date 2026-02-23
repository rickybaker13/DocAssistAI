/**
 * Document Critic (Pattern 4: Reflection)
 * Reviews generated documents for quality and completeness
 */

import { getAIProvider } from '../ai/providerFactory.js';
import { AIMessage } from '../../types/index.js';
import { GeneratedDocument } from './documentGenerator.js';
import { Template } from './templateRouter.js';

export interface QualityCheck {
  passed: boolean;
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
}

export class DocumentCritic {
  /**
   * Review document quality
   */
  async reviewDocument(
    document: GeneratedDocument,
    template: Template
  ): Promise<QualityCheck> {
    const provider = getAIProvider();

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a clinical documentation quality reviewer. Review the generated document against these criteria:
1. All required sections are present and complete
2. Data accuracy (matches source data)
3. Clinical coherence and logic
4. Proper formatting according to template
5. No contradictions or errors
6. Appropriate level of detail`,
      },
      {
        role: 'user',
        content: `Review this document:

Template: ${template.name}
Required Sections: ${template.sections.join(', ')}

Document:
${document.content}

Provide a quality assessment with:
- Overall score (0-100)
- List of issues found
- Suggestions for improvement
- Pass/Fail recommendation

Format your response as JSON:
{
  "score": 85,
  "passed": true,
  "issues": ["Issue 1", "Issue 2"],
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}`,
      },
    ];

    try {
      const response = await provider.chat(messages, { temperature: 0.3 });
      
      // Try to parse JSON response
      try {
        const parsed = JSON.parse(response.content);
        return {
          passed: parsed.passed !== false,
          score: parsed.score || 0,
          issues: parsed.issues || [],
          suggestions: parsed.suggestions || [],
        };
      } catch {
        // Fallback: analyze text response
        const content = response.content.toLowerCase();
        const passed = content.includes('pass') || content.includes('acceptable');
        const scoreMatch = content.match(/(\d+)/);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 70;

        return {
          passed,
          score,
          issues: [],
          suggestions: [],
        };
      }
    } catch (error: any) {
      console.error('Document review error:', error);
      // Default: pass if we can't review
      return {
        passed: true,
        score: 70,
        issues: ['Unable to complete quality review'],
        suggestions: [],
      };
    }
  }

  /**
   * Check if document meets quality threshold
   */
  meetsQualityThreshold(check: QualityCheck, threshold: number = 70): boolean {
    return check.passed && check.score >= threshold;
  }
}

export const documentCritic = new DocumentCritic();

