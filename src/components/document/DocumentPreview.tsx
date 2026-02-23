/**
 * Document Preview Component
 * Shows generated document with editing capabilities
 */

import { useState } from 'react';
import { GeneratedDocument, QualityCheck } from '../../stores/documentStore';

interface DocumentPreviewProps {
  document: GeneratedDocument;
  qualityCheck: QualityCheck | null;
  isEditing: boolean;
  onEdit: (command: string) => void;
  onApprove: () => void;
  onReject: () => void;
}

export default function DocumentPreview({
  document,
  qualityCheck,
  isEditing,
  onEdit,
  onApprove,
  onReject,
}: DocumentPreviewProps) {
  const [editCommand, setEditCommand] = useState('');
  const [showEditInput, setShowEditInput] = useState(false);

  const handleEditSubmit = () => {
    if (editCommand.trim()) {
      onEdit(editCommand);
      setEditCommand('');
      setShowEditInput(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Generated Document</h3>
          <p className="text-sm text-gray-600 mt-1">
            Template: {document.metadata.templateId} | Type: {document.metadata.noteType} | Author: {document.metadata.author}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEditInput(!showEditInput)}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            {showEditInput ? 'Cancel Edit' : 'Edit Document'}
          </button>
        </div>
      </div>

      {/* Quality Check */}
      {qualityCheck && (
        <div className={`p-4 rounded-lg border-2 ${
          qualityCheck.passed
            ? 'border-green-200 bg-green-50'
            : 'border-yellow-200 bg-yellow-50'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`font-semibold ${
              qualityCheck.passed ? 'text-green-800' : 'text-yellow-800'
            }`}>
              Quality Score: {qualityCheck.score}/100
            </span>
            {qualityCheck.passed ? (
              <span className="text-green-600">✓ Passed</span>
            ) : (
              <span className="text-yellow-600">⚠ Needs Review</span>
            )}
          </div>
          {qualityCheck.issues.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-700">Issues:</p>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {qualityCheck.issues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          {qualityCheck.suggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-700">Suggestions:</p>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {qualityCheck.suggestions.map((suggestion, idx) => (
                  <li key={idx}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Edit Input */}
      {showEditInput && (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Edit Command (Natural Language)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={editCommand}
              onChange={(e) => setEditCommand(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleEditSubmit()}
              placeholder="e.g., 'Add lactate trend', 'Expand assessment section', 'Remove social history'"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isEditing}
            />
            <button
              onClick={handleEditSubmit}
              disabled={!editCommand.trim() || isEditing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isEditing ? 'Editing...' : 'Apply'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Examples: "Add lactate trend", "Include heart rate graph for last 3 days", "Expand assessment"
          </p>
        </div>
      )}

      {/* Document Content */}
      <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
        <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800">
          {document.content}
        </pre>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <button
          onClick={onReject}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Reject
        </button>
        <button
          onClick={onApprove}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Approve & Save
        </button>
      </div>
    </div>
  );
}

