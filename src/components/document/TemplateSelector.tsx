/**
 * Template Selector
 * Selects note type for document generation
 */

interface TemplateSelectorProps {
  selectedTemplate: string | null;
  onTemplateSelect: (template: string) => void;
  userContext: {
    role: 'MD' | 'NP' | 'PA' | 'RN' | 'PT' | 'ST' | 'RT' | 'WC' | 'PC' | 'CH' | 'OTHER';
    service?: string;
    name?: string;
  } | null;
}

export default function TemplateSelector({ selectedTemplate, onTemplateSelect, userContext }: TemplateSelectorProps) {
  const templates = [
    { value: 'progress_note', label: 'Progress Note', description: 'Daily progress note (propagates previous note)' },
    { value: 'h_and_p', label: 'History & Physical', description: 'Initial H&P documentation' },
    { value: 'discharge_summary', label: 'Discharge Summary', description: 'Discharge documentation' },
    { value: 'accept_note', label: 'Accept Note', description: 'Transfer/accept note' },
    { value: 'procedure_note', label: 'Procedure Note', description: 'Procedure documentation' },
    { value: 'consult_note', label: 'Consultation Note', description: 'Consultation documentation' },
  ];

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Note Type *</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((template) => (
          <button
            key={template.value}
            onClick={() => onTemplateSelect(template.value)}
            disabled={!userContext}
            className={`p-4 border-2 rounded-lg text-left transition-all ${
              selectedTemplate === template.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            } ${!userContext ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className="font-semibold text-gray-900">{template.label}</div>
            <div className="text-sm text-gray-600 mt-1">{template.description}</div>
          </button>
        ))}
      </div>
      {!userContext && (
        <p className="mt-2 text-sm text-gray-500">Please set user context first</p>
      )}
    </div>
  );
}

