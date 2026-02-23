import { useState, useRef, useEffect } from 'react';
import React from 'react';
import { useChatStore } from '../../stores/chatStore';
import { usePatientStore } from '../../stores/patientStore';
import { aiService } from '../../services/ai/aiService';
import { ChatMessage } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';

/**
 * Renders an AI response string with inline citation chips.
 * [Source: <label>, <timestamp>] tags are highlighted as blue monospace chips.
 */
const renderWithCitations = (text: string): React.ReactNode => {
  const parts = text.split(/(\[Source:[^\]]+\])/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('[Source:') ? (
          <span
            key={i}
            className="inline-block text-xs bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 ml-1 font-mono"
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

export default function ChatInterface() {
  const { messages, addMessage, isLoading, setLoading, setError } = useChatStore();
  const { patientSummary } = usePatientStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatPatientContext = (): string => {
    if (!patientSummary) return 'No patient data available.';
    
    const context = [
      `Patient: ${patientSummary.patient.name?.[0]?.given?.join(' ') || 'Unknown'} ${patientSummary.patient.name?.[0]?.family || ''}`,
      `MRN: ${patientSummary.patient.identifier?.[0]?.value || 'Unknown'}`,
      `DOB: ${patientSummary.patient.birthDate || 'Unknown'} (Age: ${patientSummary.patient.birthDate ? Math.floor((new Date().getTime() - new Date(patientSummary.patient.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 'Unknown'})`,
      `Gender: ${patientSummary.patient.gender || 'Unknown'}`,
      `\n=== ADMISSION INFORMATION ===`,
      `Admission Date: ${(patientSummary.recentEncounters || patientSummary.encounters || [])?.[0]?.period?.start ? new Date((patientSummary.recentEncounters || patientSummary.encounters || [])[0].period.start).toLocaleDateString() : '2 weeks ago'}`,
      `Current Location: ${(patientSummary.recentEncounters || patientSummary.encounters || [])?.find(e => e.status === 'active')?.class?.display || 'Inpatient Floor'}`,
    ];

    if (patientSummary.conditions.length > 0) {
      context.push(`\n=== ACTIVE CONDITIONS ===`);
      patientSummary.conditions.forEach(c => {
        const onset = c.onsetDateTime ? new Date(c.onsetDateTime).toLocaleDateString() : 'Unknown';
        const status = c.clinicalStatus?.coding?.[0]?.display || 'Unknown';
        context.push(`- ${c.code?.text || 'Unknown'} (${status}, Onset: ${onset})`);
      });
    }

    if (patientSummary.medications.length > 0) {
      context.push(`\n=== CURRENT MEDICATIONS ===`);
      patientSummary.medications.forEach(m => {
        const medName = m.medicationCodeableConcept?.text || 'Unknown';
        const status = m.status || 'Unknown';
        context.push(`- ${medName} (${status})`);
      });
    }

    if (patientSummary.allergies.length > 0) {
      context.push(`\n=== ALLERGIES ===`);
      patientSummary.allergies.forEach(a => {
        const allergen = a.code?.text || 'Unknown';
        const severity = a.criticality || 'Unknown';
        const reaction = a.reaction?.[0]?.manifestation?.[0]?.text || 'Unknown';
        context.push(`- ${allergen} (${severity} severity, Reaction: ${reaction})`);
      });
    }

    const labs = patientSummary.recentLabs || patientSummary.labResults || [];
    if (labs.length > 0) {
      context.push(`\n=== RECENT LABORATORY RESULTS (Last 10) ===`);
      labs.slice(0, 10).forEach(l => {
        const labName = l.code?.text || 'Unknown';
        const value = l.valueQuantity ? `${l.valueQuantity.value} ${l.valueQuantity.unit}` : l.valueString || 'N/A';
        const date = l.effectiveDateTime ? new Date(l.effectiveDateTime).toLocaleDateString() : 'Unknown';
        context.push(`- ${labName}: ${value} (${date})`);
      });
    }

    const vitals = patientSummary.recentVitals || patientSummary.vitalSigns || [];
    if (vitals.length > 0) {
      context.push(`\n=== RECENT VITAL SIGNS (Last 5) ===`);
      vitals.slice(0, 5).forEach(v => {
        const vitalName = v.code?.text || 'Unknown';
        const value = v.valueQuantity ? `${v.valueQuantity.value} ${v.valueQuantity.unit}` : 
                      v.component ? `${v.component[0]?.valueQuantity?.value}/${v.component[1]?.valueQuantity?.value} ${v.component[0]?.valueQuantity?.unit}` : 'N/A';
        const date = v.effectiveDateTime ? new Date(v.effectiveDateTime).toLocaleString() : 'Unknown';
        context.push(`- ${vitalName}: ${value} (${date})`);
      });
    }

    if (patientSummary.fluidIO && patientSummary.fluidIO.length > 0) {
      context.push(`\n=== FLUID INTAKE/OUTPUT (Last 3 days) ===`);
      patientSummary.fluidIO.slice(-6).forEach(io => {
        const type = io.code?.text || 'Unknown';
        const value = io.valueQuantity ? `${io.valueQuantity.value} ${io.valueQuantity.unit}` : 'N/A';
        const date = io.effectiveDateTime ? new Date(io.effectiveDateTime).toLocaleDateString() : 'Unknown';
        context.push(`- ${type}: ${value} (${date})`);
      });
    }

    if (patientSummary.imagingReports && patientSummary.imagingReports.length > 0) {
      context.push(`\n=== IMAGING STUDIES ===`);
      patientSummary.imagingReports.forEach(img => {
        const study = img.code?.text || 'Unknown';
        const date = img.effectiveDateTime ? new Date(img.effectiveDateTime).toLocaleDateString() : 'Unknown';
        const conclusion = img.conclusion || 'No conclusion';
        context.push(`- ${study} (${date}): ${conclusion.substring(0, 100)}...`);
      });
    }

    if (patientSummary.procedures && patientSummary.procedures.length > 0) {
      context.push(`\n=== PROCEDURES ===`);
      patientSummary.procedures.forEach(proc => {
        const procName = proc.code?.text || 'Unknown';
        const date = proc.performedDateTime ? new Date(proc.performedDateTime).toLocaleDateString() : 'Unknown';
        const status = proc.status || 'Unknown';
        context.push(`- ${procName} (${date}, Status: ${status})`);
      });
    }

    if (patientSummary.clinicalNotes && patientSummary.clinicalNotes.length > 0) {
      context.push(`\n=== CLINICAL NOTES SUMMARY ===`);
      const noteTypes = new Set(patientSummary.clinicalNotes.map(n => n.type));
      noteTypes.forEach(type => {
        const count = patientSummary.clinicalNotes!.filter(n => n.type === type).length;
        context.push(`- ${type}: ${count} notes`);
      });
    }

    return context.join('\n');
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      patientContext: true,
    };

    addMessage(userMessage);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const patientContext = formatPatientContext();
      // Use RAG by default (backend will handle retrieval)
      const response = await aiService.queryPatientData(input, patientContext, true);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        patientContext: true,
      };

      addMessage(assistantMessage);
    } catch (error) {
      console.error('Chat error:', error);
      setError(error instanceof Error ? error.message : 'Failed to get AI response');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow h-[600px] flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">AI Assistant</h2>
        <p className="text-xs text-gray-600 mt-1">Ask questions about the patient</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-sm">Start a conversation about the patient</p>
            <p className="text-xs mt-2">Example: "What are the patient's active conditions?"</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">
                {message.role === 'assistant'
                  ? renderWithCitations(message.content)
                  : message.content}
              </p>
              <p className="text-xs mt-1 opacity-70">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <LoadingSpinner message="" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about the patient..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

