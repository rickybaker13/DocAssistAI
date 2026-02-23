/**
 * Note Content Extractor
 * Extracts and decodes note content from DocumentReference resources
 * Handles various content formats (base64, URL, text, etc.)
 */

export interface ExtractedNote {
  id: string;
  type: string;
  title: string;
  author: string;
  authorId?: string;
  date: string;
  status: string;
  category: string[];
  content: string;
  contentType: string;
  sourceUrl?: string;
  encounterId?: string;
  encounterDate?: string;
  rawDocumentReference: any;
}

class NoteContentExtractor {
  /**
   * Extract note content from DocumentReference
   */
  async extractNote(docRef: any): Promise<ExtractedNote | null> {
    try {
      // Extract metadata
      const type = docRef.type?.coding?.[0]?.display || 
                   docRef.type?.text || 
                   docRef.type?.coding?.[0]?.code || 
                   'Unknown';
      
      const title = docRef.description || 
                   docRef.type?.coding?.[0]?.display || 
                   type;
      
      const author = this.extractAuthor(docRef.author);
      const authorId = this.extractAuthorId(docRef.author);
      
      const date = docRef.date || 
                  docRef.indexed || 
                  docRef.meta?.lastUpdated || 
                  new Date().toISOString();
      
      const status = docRef.status || 'unknown';
      
      const category = (docRef.category || []).map((cat: any) => 
        cat.coding?.[0]?.display || cat.text || cat.coding?.[0]?.code || 'Unknown'
      );

      // Extract content
      const contentResult = await this.extractContent(docRef);
      
      if (!contentResult.content) {
        console.warn(`[Note Extractor] No content found for DocumentReference ${docRef.id}`);
        return null;
      }

      // Handle PDF content - create data URL if needed
      let pdfDataUrl: string | undefined;
      let finalContent = contentResult.content;
      
      if (contentResult.contentType === 'application/pdf' || contentResult.content.startsWith('[PDF_DOCUMENT_MARKER:')) {
        // Extract URL from marker if present
        const markerMatch = contentResult.content.match(/\[PDF_DOCUMENT_MARKER:(.+)\]/);
        const pdfUrl = markerMatch ? markerMatch[1] : contentResult.url;
        
        if (pdfUrl) {
          // Try to fetch and create data URL
          try {
            // Oracle Health requires specific Accept header for Binary resources
            const binaryResponse = await fetch(pdfUrl, {
              headers: { 
                'Accept': 'application/pdf, application/octet-stream',
              },
            });
            
            if (binaryResponse.ok) {
              const arrayBuffer = await binaryResponse.arrayBuffer();
              const base64 = this.arrayBufferToBase64(arrayBuffer);
              pdfDataUrl = this.createPDFDataUrl(base64);
              finalContent = `PDF Document (${pdfUrl})`;
            }
          } catch (error) {
            console.warn('[Note Extractor] Failed to create PDF data URL:', error);
          }
        }
      }

      // Extract encounter info if available
      const encounterId = docRef.context?.encounter?.[0]?.reference?.replace('Encounter/', '');
      const encounterDate = docRef.context?.period?.start;

      return {
        id: docRef.id || `doc-${Date.now()}`,
        type,
        title,
        author,
        authorId,
        date,
        status,
        category,
        content: finalContent,
        contentType: contentResult.contentType,
        sourceUrl: contentResult.url,
        pdfDataUrl,
        encounterId,
        encounterDate,
        rawDocumentReference: docRef,
      };
    } catch (error: any) {
      console.error(`[Note Extractor] Error extracting note ${docRef.id}:`, error);
      return null;
    }
  }

  /**
   * Extract content from DocumentReference
   */
  private async extractContent(docRef: any): Promise<{ content: string; contentType: string; url?: string }> {
    if (!docRef.content || docRef.content.length === 0) {
      return { content: '', contentType: 'unknown' };
    }

    // Try each content attachment
    for (const contentItem of docRef.content) {
      const attachment = contentItem.attachment;
      if (!attachment) continue;

      // Check for embedded base64 data
      if (attachment.data) {
        try {
          // Decode base64
          const decoded = this.decodeBase64(attachment.data);
          return {
            content: decoded,
            contentType: attachment.contentType || 'text/plain',
          };
        } catch (error) {
          console.warn('[Note Extractor] Failed to decode base64:', error);
        }
      }

      // Check for URL
      if (attachment.url) {
        try {
          // Check if it's a Binary resource URL (common in Cerner/Oracle Health)
          const isBinaryUrl = attachment.url.includes('/Binary/');
          
          if (isBinaryUrl) {
            // Fetch Binary resource
            const binaryContent = await this.fetchBinaryResource(attachment.url);
            if (binaryContent) {
              return {
                content: binaryContent.content,
                contentType: binaryContent.contentType || attachment.contentType || 'text/plain',
                url: attachment.url,
              };
            }
          } else {
            // Try to fetch content directly from URL
            const fetchedContent = await this.fetchContentFromUrl(attachment.url);
            if (fetchedContent) {
              return {
                content: fetchedContent,
                contentType: attachment.contentType || 'text/html',
                url: attachment.url,
              };
            }
          }
        } catch (error) {
          console.warn('[Note Extractor] Failed to fetch from URL:', error);
        }
        
        // If fetch failed, return URL reference
        return {
          content: `[Content available at: ${attachment.url}]`,
          contentType: attachment.contentType || 'unknown',
          url: attachment.url,
        };
      }

      // Check for title as fallback
      if (attachment.title) {
        return {
          content: attachment.title,
          contentType: 'text/plain',
        };
      }
    }

    return { content: '', contentType: 'unknown' };
  }

  /**
   * Decode base64 content
   */
  private decodeBase64(data: string): string {
    try {
      // Remove data URI prefix if present
      const base64Data = data.includes(',') ? data.split(',')[1] : data;
      
      // Decode base64
      if (typeof atob !== 'undefined') {
        // Browser environment
        return atob(base64Data);
      } else {
        // Node.js environment (for backend)
        return Buffer.from(base64Data, 'base64').toString('utf-8');
      }
    } catch (error) {
      console.error('[Note Extractor] Base64 decode error:', error);
      return data; // Return original if decode fails
    }
  }

  /**
   * Fetch Binary resource from FHIR Binary endpoint
   */
  private async fetchBinaryResource(url: string): Promise<{ content: string; contentType: string } | null> {
    try {
      console.log(`[Note Extractor] Fetching Binary resource from: ${url}`);
      
      // Oracle Health requires specific Accept header format
      // Try to get raw binary first (PDF, text, etc.)
      const binaryResponse = await fetch(url, {
        headers: {
          'Accept': 'application/pdf, application/octet-stream, */*',
        },
      });

      if (binaryResponse.ok) {
        const contentType = binaryResponse.headers.get('content-type') || 'application/octet-stream';
        const arrayBuffer = await binaryResponse.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Check if it's PDF by magic bytes
        if (this.isPDFBinary(uint8Array) || contentType.includes('pdf')) {
          // Convert to base64 for PDF viewer
          const base64 = this.arrayBufferToBase64(arrayBuffer);
          return {
            content: this.handlePDFContent(base64, url),
            contentType: 'application/pdf',
          };
        }
        
        // Try to decode as text
        try {
          const decoder = new TextDecoder('utf-8');
          const text = decoder.decode(uint8Array);
          
          // Check if it looks like PDF text content
          if (text.includes('endstream') && text.includes('endobj')) {
            const base64 = this.arrayBufferToBase64(arrayBuffer);
            return {
              content: this.handlePDFContent(base64, url),
              contentType: 'application/pdf',
            };
          }
          
          return {
            content: text,
            contentType: contentType,
          };
        } catch {
          // If text decode fails, it's binary
          return {
            content: `[Binary content - Content-Type: ${contentType}. Use PDF viewer to display.]`,
            contentType: contentType,
          };
        }
      }

      // If raw binary fetch failed, try as FHIR Binary resource (JSON)
      const jsonResponse = await fetch(url, {
        headers: {
          'Accept': 'application/fhir+json',
        },
      });

      if (jsonResponse.ok) {
        const contentType = jsonResponse.headers.get('content-type') || '';
        
        if (contentType.includes('application/json') || contentType.includes('application/fhir+json')) {
          // It's a FHIR Binary resource
          const binaryResource = await jsonResponse.json();
          
          if (binaryResource.resourceType === 'Binary') {
            const binaryContentType = binaryResource.contentType || 'application/octet-stream';
            
            // Extract content from Binary resource
            if (binaryResource.data) {
              // Decode base64 data
              const decoded = this.decodeBase64(binaryResource.data);
              
              // Handle PDF content
              if (binaryContentType.includes('pdf') || this.isPDFContent(decoded)) {
                return {
                  content: this.handlePDFContent(binaryResource.data, url), // Use original base64
                  contentType: 'application/pdf',
                };
              }
              
              // Handle plain text
              if (binaryContentType.includes('text') || binaryContentType.includes('plain')) {
                return {
                  content: decoded,
                  contentType: 'text/plain',
                };
              }
              
              // Handle HTML
              if (binaryContentType.includes('html')) {
                return {
                  content: decoded,
                  contentType: 'text/html',
                };
              }
              
              // For other types, return as-is
              return {
                content: decoded,
                contentType: binaryContentType,
              };
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[Note Extractor] Binary resource fetch error:', error);
      return null;
    }
  }

  /**
   * Check if content is PDF by magic bytes
   */
  private isPDFBinary(uint8Array: Uint8Array): boolean {
    // PDF magic bytes: %PDF
    return uint8Array.length >= 4 &&
           uint8Array[0] === 0x25 && // %
           uint8Array[1] === 0x50 && // P
           uint8Array[2] === 0x44 && // D
           uint8Array[3] === 0x46;   // F
  }

  /**
   * Check if decoded content looks like PDF
   */
  private isPDFContent(content: string): boolean {
    return content.includes('%PDF') || 
           (content.includes('endstream') && content.includes('endobj')) ||
           content.includes('stream') && content.includes('obj');
  }

  /**
   * Handle PDF content - create data URL for PDF viewer
   */
  private handlePDFContent(content: string, url: string): string {
    // Return a marker that this is PDF content
    // The actual PDF data URL will be created in extractNote
    return `[PDF_DOCUMENT_MARKER:${url}]`;
  }

  /**
   * Create PDF data URL from base64 content
   */
  private createPDFDataUrl(base64Content: string): string {
    // Ensure it's proper base64 (remove data URI prefix if present)
    const base64Data = base64Content.includes(',') ? base64Content.split(',')[1] : base64Content;
    return `data:application/pdf;base64,${base64Data}`;
  }

  /**
   * Convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Fetch content from URL
   */
  private async fetchContentFromUrl(url: string): Promise<string | null> {
    try {
      console.log(`[Note Extractor] Fetching content from URL: ${url}`);
      
      // Check if it's a Binary resource URL
      const isBinaryUrl = url.includes('/Binary/');
      
      // Oracle Health requires specific Accept headers
      const acceptHeader = isBinaryUrl 
        ? 'application/pdf, application/octet-stream' 
        : 'text/plain, text/html, application/json, application/fhir+json';
      
      const response = await fetch(url, {
        headers: {
          'Accept': acceptHeader,
        },
      });

      if (!response.ok) {
        console.warn(`[Note Extractor] URL fetch failed: ${response.status} ${response.statusText}`);
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      
      // Handle different content types
      if (contentType.includes('application/json') || contentType.includes('application/fhir+json')) {
        // Try parsing as JSON (might be FHIR Binary resource)
        const json = await response.json();
        if (json.resourceType === 'Binary' && json.data) {
          return this.decodeBase64(json.data);
        }
        return JSON.stringify(json, null, 2);
      } else {
        // Plain text or HTML
        return await response.text();
      }
    } catch (error) {
      console.warn('[Note Extractor] URL fetch error:', error);
      return null;
    }
  }

  /**
   * Extract author name
   */
  private extractAuthor(authorRef?: any): string {
    if (!authorRef) return 'Unknown';

    // If it's an array, take first
    const ref = Array.isArray(authorRef) ? authorRef[0] : authorRef;

    // If it's a reference string
    if (typeof ref === 'string') {
      return ref.split('/').pop() || 'Unknown';
    }

    // If it's a Reference object with display
    if (ref.display) {
      return ref.display;
    }

    // If it's a Reference object
    if (ref.reference) {
      return ref.reference.split('/').pop() || 'Unknown';
    }

    return 'Unknown';
  }

  /**
   * Extract author ID
   */
  private extractAuthorId(authorRef?: any): string | undefined {
    if (!authorRef) return undefined;

    const ref = Array.isArray(authorRef) ? authorRef[0] : authorRef;

    if (typeof ref === 'string') {
      return ref.split('/').pop();
    }

    if (ref.reference) {
      return ref.reference.split('/').pop();
    }

    return undefined;
  }

  /**
   * Extract all notes from DocumentReference resources
   */
  async extractAllNotes(documentRefs: any[]): Promise<ExtractedNote[]> {
    console.log(`[Note Extractor] Extracting ${documentRefs.length} notes...`);
    
    const notes = await Promise.all(
      documentRefs.map(docRef => this.extractNote(docRef))
    );

    // Filter out null results
    return notes.filter((note): note is ExtractedNote => note !== null);
  }

  /**
   * Format note content for display (preserve original formatting)
   */
  formatNoteForDisplay(note: ExtractedNote): string {
    // If content is HTML, return as-is
    if (note.contentType.includes('html')) {
      return note.content;
    }

    // If content is plain text, preserve line breaks
    return note.content.replace(/\n/g, '<br>');
  }
}

export const noteContentExtractor = new NoteContentExtractor();

