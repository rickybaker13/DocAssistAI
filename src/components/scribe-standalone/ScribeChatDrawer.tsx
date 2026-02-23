import React, { useState, useRef, useEffect } from 'react';
import { getBackendUrl } from '../../config/appConfig';

interface Section {
  id: string;
  section_name: string;
  content: string | null;
  confidence: number | null;
  display_order: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  sections: Section[];
  noteType: string;
  onInsert: (sectionId: string, text: string) => void;
}

const makeId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const ScribeChatDrawer: React.FC<Props> = ({ sections, noteType, onInsert }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ghostState, setGhostState] = useState<{
    answerId: string;
    selectedSection: string;
    ghostWritten: string | null;
    loadingGhost: boolean;
    ghostError: string | null;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: makeId(), role: 'user', content: userMsg }]);
    setLoading(true);
    try {
      const res = await fetch(`${getBackendUrl()}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { id: makeId(), role: 'assistant', content: data.response || data.error || 'No response' }]);
    } catch (e: unknown) {
      setMessages(prev => [...prev, { id: makeId(), role: 'assistant', content: 'Error: ' + (e instanceof Error ? e.message : 'Unknown error') }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToNote = (messageId: string) => {
    setGhostState({ answerId: messageId, selectedSection: sections[0]?.id || '', ghostWritten: null, loadingGhost: false, ghostError: null });
  };

  const handleGhostWrite = async () => {
    if (!ghostState) return;
    const answerMsg = messages.find(m => m.id === ghostState.answerId);
    if (!answerMsg) return;
    const answer = answerMsg.content;
    const section = sections.find(s => s.id === ghostState.selectedSection);
    if (!section) return;

    setGhostState(prev => prev ? { ...prev, loadingGhost: true, ghostError: null } : null);
    try {
      const res = await fetch(`${getBackendUrl()}/api/ai/scribe/ghost-write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          chatAnswer: answer,
          destinationSection: section.section_name,
          existingContent: section.content || '',
          noteType,
        }),
      });
      if (!res.ok) throw new Error(`Ghost-write failed (${res.status})`);
      const data = await res.json();
      setGhostState(prev => prev ? { ...prev, ghostWritten: data.ghostWritten, loadingGhost: false } : null);
    } catch (e: unknown) {
      setGhostState(prev => prev ? { ...prev, ghostWritten: null, loadingGhost: false, ghostError: e instanceof Error ? e.message : 'Ghost-write failed' } : null);
    }
  };

  const handleConfirmInsert = () => {
    if (!ghostState?.ghostWritten) return;
    onInsert(ghostState.selectedSection, ghostState.ghostWritten);
    setGhostState(null);
  };

  return (
    <>
      {/* Floating chat button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat"
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-blue-700 transition-colors"
        >
          💬
        </button>
      )}

      {/* Drawer */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-auto sm:right-6 sm:bottom-6 sm:w-96 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col" style={{ maxHeight: '70vh' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 text-sm">Clinical Assistant</h2>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="text-gray-400 hover:text-gray-600 text-xl">×</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Ask a clinical question about this patient or encounter.</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {msg.content}
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleAddToNote(msg.id)}
                      aria-label="Add to note"
                      className="block mt-1 text-xs text-blue-600 hover:underline"
                    >
                      + Add to note ▾
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-xl px-3 py-2 text-sm text-gray-500 animate-pulse">Thinking...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Ghost-write panel */}
          {ghostState && (
            <div className="border-t border-gray-200 p-3 bg-purple-50 space-y-2">
              <p className="text-xs font-semibold text-purple-700">Add to section:</p>
              <select
                value={ghostState.selectedSection}
                onChange={e => setGhostState(prev => prev ? { ...prev, selectedSection: e.target.value, ghostWritten: null } : null)}
                aria-label="Select section"
                className="w-full text-sm border border-purple-200 rounded px-2 py-1 bg-white"
              >
                {sections.map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
              </select>
              {!ghostState.ghostWritten ? (
                <button
                  onClick={handleGhostWrite}
                  disabled={ghostState.loadingGhost}
                  className="w-full text-sm bg-purple-600 text-white rounded-lg py-1.5 hover:bg-purple-700 disabled:opacity-50"
                >
                  {ghostState.loadingGhost ? 'Rewriting...' : 'Ghost-write in physician voice'}
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-purple-700">Preview:</p>
                  <p className="text-sm bg-green-50 border border-green-200 rounded p-2 text-green-800">{ghostState.ghostWritten}</p>
                  <div className="flex gap-2">
                    <button onClick={handleConfirmInsert} aria-label="Confirm insert into note" className="flex-1 text-sm bg-green-600 text-white rounded-lg py-1.5 hover:bg-green-700">
                      Confirm ✓
                    </button>
                    <button onClick={() => setGhostState(null)} aria-label="Cancel ghost-write" className="text-sm text-gray-400 hover:text-gray-600 px-2">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {ghostState.ghostError && (
                <p className="text-xs text-red-600">{ghostState.ghostError}</p>
              )}
            </div>
          )}

          {/* Input */}
          <form onSubmit={sendMessage} className="border-t border-gray-200 p-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask a clinical question..."
              aria-label="Chat input"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              ↑
            </button>
          </form>
        </div>
      )}
    </>
  );
};
