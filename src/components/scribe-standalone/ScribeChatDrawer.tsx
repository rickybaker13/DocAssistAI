import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, ArrowRight, Send } from 'lucide-react';
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
  verbosity: string;
  onInsert: (sectionId: string, text: string) => void;
}

const makeId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const ScribeChatDrawer: React.FC<Props> = ({ sections, noteType, verbosity, onInsert }) => {
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

    const newUserMsg: ChatMessage = { id: makeId(), role: 'user', content: userMsg };
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      // Build a brief note context so the AI knows what encounter this is about
      const noteContext = [
        `Note type: ${noteType}`,
        sections.length > 0
          ? `Current note sections:\n${sections.map(s => `- ${s.section_name}: ${(s.content || '').slice(0, 200)}`).join('\n')}`
          : '',
      ].filter(Boolean).join('\n');

      const res = await fetch(`${getBackendUrl()}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          patientContext: noteContext,
        }),
      });
      const data = await res.json();
      // Response shape: { success, cited, data: { content: string } } or { error: string }
      const content = data.data?.content || data.error || 'No response';
      setMessages(prev => [...prev, { id: makeId(), role: 'assistant', content }]);
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
          verbosity,
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
          aria-label="Open chat"
          className="fixed bottom-20 right-5 md:bottom-6 md:right-6 z-40 w-14 h-14 bg-teal-400 text-slate-900 rounded-full shadow-[0_0_20px_rgba(45,212,191,0.25)] flex items-center justify-center hover:bg-teal-300 hover:shadow-[0_0_28px_rgba(45,212,191,0.35)] transition-all duration-150"
        >
          <MessageSquare size={22} aria-hidden="true" />
        </button>
      )}

      {/* Drawer */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-auto sm:right-6 sm:bottom-6 sm:w-96 bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-700 flex flex-col" style={{ maxHeight: '70vh' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <h2 className="font-semibold text-slate-100 text-sm flex items-center gap-1.5">
              <MessageSquare size={15} className="text-teal-400" aria-hidden="true" />
              Clinical Assistant
            </h2>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="text-slate-500 hover:text-slate-300 transition-colors">
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Messages — C1: aria-live so new messages are announced to screen readers */}
          <div
            className="flex-1 overflow-y-auto p-4 space-y-3"
            aria-live="polite"
            aria-atomic="false"
          >
            {messages.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">Ask a clinical question about this patient or encounter.</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`text-sm ${msg.role === 'user' ? 'bg-teal-400/20 text-teal-300 rounded-2xl rounded-br-sm px-3 py-2 max-w-[85%] ml-auto' : 'bg-slate-800 text-slate-100 rounded-2xl rounded-bl-sm px-3 py-2 max-w-[85%]'}`}>
                  {msg.content}
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => handleAddToNote(msg.id)}
                      aria-label="Add to note"
                      className="flex items-center gap-0.5 mt-1 text-xs text-teal-400 hover:text-teal-300"
                    >
                      + Add to note <ArrowRight size={11} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {/* C2: role="status" so "Thinking..." is announced as a live status region */}
            {loading && (
              <div className="flex justify-start">
                <div role="status" className="bg-slate-800 text-slate-500 animate-pulse rounded-2xl rounded-bl-sm px-3 py-2 text-sm">Thinking...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Ghost-write panel */}
          {ghostState && (
            <div className="border-t border-slate-700 p-3 bg-violet-950/50 space-y-2">
              <p className="text-xs font-semibold text-violet-400">Add to section:</p>
              {/* C4: more descriptive aria-label for the section select */}
              <select
                value={ghostState.selectedSection}
                onChange={e => setGhostState(prev => prev ? { ...prev, selectedSection: e.target.value, ghostWritten: null } : null)}
                aria-label="Select destination note section"
                className="w-full text-sm bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                {sections.map(s => <option key={s.id} value={s.id}>{s.section_name}</option>)}
              </select>
              {!ghostState.ghostWritten ? (
                <button
                  onClick={handleGhostWrite}
                  disabled={ghostState.loadingGhost}
                  className="w-full text-sm bg-violet-500 text-white font-semibold rounded-lg py-1.5 hover:bg-violet-400 disabled:opacity-50"
                >
                  {ghostState.loadingGhost ? 'Rewriting...' : 'Ghost-write in physician voice'}
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-violet-400">Preview:</p>
                  <p className="text-sm bg-slate-800 border border-slate-700 rounded p-2 text-slate-100">{ghostState.ghostWritten}</p>
                  <div className="flex gap-2">
                    {/* C5: wrap ✓ in aria-hidden so screen readers don't read the symbol */}
                    <button onClick={handleConfirmInsert} aria-label="Confirm insert into note" className="flex-1 text-sm bg-teal-400 text-slate-900 font-semibold rounded-lg py-1.5 hover:bg-teal-300">
                      Confirm <span aria-hidden="true">✓</span>
                    </button>
                    <button onClick={() => setGhostState(null)} aria-label="Cancel ghost-write" className="text-sm text-slate-500 hover:text-slate-300 px-2">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {ghostState.ghostError && (
                <p className="text-xs text-red-400">{ghostState.ghostError}</p>
              )}
            </div>
          )}

          {/* Input */}
          <form onSubmit={sendMessage} className="border-t border-slate-700 p-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask a clinical question..."
              aria-label="Chat input"
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-50 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-teal-400 transition-colors flex-1"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="bg-teal-400 text-slate-900 rounded-lg px-3 py-2 hover:bg-teal-300 disabled:opacity-50 transition-colors flex items-center justify-center"
            >
              <Send size={16} aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
