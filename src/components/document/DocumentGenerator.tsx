/**
 * Document Generator Component
 * Main UI for document generation with agent-based system
 */

import { useState } from 'react';
import { usePatientStore } from '../../stores/patientStore';
import { useDocumentStore } from '../../stores/documentStore';
import { documentService } from '../../services/document/documentService';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorMessage from '../common/ErrorMessage';
import DocumentPreview from './DocumentPreview';
import TemplateSelector from './TemplateSelector';
import UserContextSelector from './UserContextSelector';

export default function DocumentGenerator() {
  const { patientSummary } = usePatientStore();
  const {
    currentDocument,
    qualityCheck,
    isGenerating,
    isEditing,
    selectedTemplate,
    userContext,
    setCurrentDocument,
    setQualityCheck,
    setGenerating,
    setEditing,
    setSelectedTemplate,
    setUserContext,
    clearDocument,
  } = useDocumentStore();

  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!patientSummary || !selectedTemplate || !userContext) {
      setError('Please select template and set user context');
      return;
    }

    setError(null);
    setGenerating(true);

    try {
      const patientId = patientSummary.patient.id || patientSummary.patient.identifier?.[0]?.value || 'mock-patient-123';
      
      console.log('[Document Generator] Generating document with:', {
        noteType: selectedTemplate,
        userContext,
        patientId,
      });

      const result = await documentService.generateDocument(
        selectedTemplate as any,
        userContext,
        patientSummary,
        patientId
      );

      console.log('[Document Generator] Document generated successfully:', result);

      if (result.document) {
        setCurrentDocument(result.document);
        setQualityCheck(result.qualityCheck);
        console.log('[Document Generator] Document state updated, preview should show');
      } else {
        throw new Error('Document generation returned no document');
      }
    } catch (err: any) {
      console.error('[Document Generator] Error:', err);
      setError(err.message || 'Failed to generate document');
    } finally {
      setGenerating(false);
    }
  };

  const handleEdit = async (command: string) => {
    if (!currentDocument || !patientSummary) return;

    setEditing(true);
    setError(null);

    try {
      const result = await documentService.editDocument(command, currentDocument, patientSummary);
      
      if (result.success) {
        setCurrentDocument(result.updatedDocument);
        // Add to edit history
        useDocumentStore.getState().addEditHistory(command);
      } else {
        setError(result.error || 'Failed to edit document');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to edit document');
    } finally {
      setEditing(false);
    }
  };

  const handleApprove = () => {
    // In real implementation, this would save to EHR
    alert('Document approved! (In production, this would save to EHR)');
    clearDocument();
  };

  const handleReject = () => {
    clearDocument();
  };

  if (!patientSummary) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">No patient data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-lg p-6 border-2 border-blue-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-600 rounded-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Document Generator</h2>
            <p className="text-sm text-gray-600">Generate clinical notes with AI-powered agent system</p>
          </div>
        </div>
        {!userContext && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Getting Started:</strong> Set your user context below, then select a note type to generate a document.
            </p>
          </div>
        )}
      </div>

      {/* Controls Section */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* User Context Selector */}
        <div className="mb-4">
          <UserContextSelector
            userContext={userContext}
            onContextChange={setUserContext}
          />
        </div>

        {/* Template Selector */}
        <div className="mb-4">
          <TemplateSelector
            selectedTemplate={selectedTemplate}
            onTemplateSelect={setSelectedTemplate}
            userContext={userContext}
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !selectedTemplate || !userContext}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isGenerating ? 'Generating...' : 'Generate Document'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex justify-between items-start">
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isGenerating && (
        <div className="bg-white rounded-lg shadow p-6">
          <LoadingSpinner message="Generating document with AI agents..." />
        </div>
      )}

      {/* Document Preview */}
      {currentDocument && !isGenerating && (
        <div className="mt-6">
          <DocumentPreview
            document={currentDocument}
            qualityCheck={qualityCheck}
            isEditing={isEditing}
            onEdit={handleEdit}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </div>
      )}

      {/* Debug Info (only in dev) */}
      {import.meta.env.DEV && currentDocument && (
        <div className="mt-4 p-4 bg-gray-100 rounded-lg text-xs text-gray-600">
          <p><strong>Debug:</strong> Document state is set. Preview should be visible above.</p>
          <p>Document ID: {currentDocument.metadata.templateId}</p>
          <p>Quality Check: {qualityCheck ? `${qualityCheck.score}/100` : 'Not available'}</p>
        </div>
      )}
    </div>
  );
}

