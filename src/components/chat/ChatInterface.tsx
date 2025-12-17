import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { usePatientStore } from '../../stores/patientStore';
import { aiService } from '../../services/ai/aiService';
import { ChatMessage } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';

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
      `DOB: ${patientSummary.patient.birthDate || 'Unknown'}`,
      `Gender: ${patientSummary.patient.gender || 'Unknown'}`,
    ];

    if (patientSummary.conditions.length > 0) {
      context.push(`\nConditions: ${patientSummary.conditions.map(c => c.code?.text || 'Unknown').join(', ')}`);
    }

    if (patientSummary.medications.length > 0) {
      context.push(`\nMedications: ${patientSummary.medications.map(m => m.medicationCodeableConcept?.text || 'Unknown').join(', ')}`);
    }

    if (patientSummary.allergies.length > 0) {
      context.push(`\nAllergies: ${patientSummary.allergies.map(a => a.code?.text || 'Unknown').join(', ')}`);
    }

    if (patientSummary.recentLabs.length > 0) {
      context.push(`\nRecent Labs: ${patientSummary.recentLabs.slice(0, 5).map(l => `${l.code?.text}: ${l.valueQuantity?.value || 'N/A'}`).join(', ')}`);
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
      const response = await aiService.queryPatientData(input, patientContext);

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
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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

