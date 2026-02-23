/**
 * PDF Viewer Component
 * Displays PDF documents inline
 */

import { useState } from 'react';

interface PDFViewerProps {
  pdfUrl?: string;
  pdfDataUrl?: string;
}

export default function PDFViewer({ pdfUrl, pdfDataUrl }: PDFViewerProps) {
  const [error, setError] = useState<string | null>(null);

  const pdfSource = pdfDataUrl || pdfUrl;

  if (!pdfSource) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">No PDF source available</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 mb-2">{error}</p>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Open PDF in new tab →
            </a>
          )}
        </div>
      ) : (
        <div className="w-full h-[600px] border border-gray-200 rounded-lg overflow-hidden">
          <iframe
            src={pdfSource}
            className="w-full h-full"
            title="PDF Viewer"
            onError={() => setError('Failed to load PDF')}
          />
        </div>
      )}
    </div>
  );
}

