import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Settings, FileText } from 'lucide-react';
import { useScribeNoteStore } from '../../stores/scribeNoteStore';

export const ScribeDashboardPage: React.FC = () => {
  const { noteId, noteType, patientLabel, status, reset } = useScribeNoteStore();

  const handleDiscard = () => {
    reset();
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-50 tracking-tight">My Notes</h1>
        <div className="flex items-center gap-2">
          <Link
            to="/scribe/settings"
            aria-label="Settings"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Settings size={18} />
          </Link>
          <Link
            to="/scribe/note/new"
            className="hidden md:flex items-center gap-1.5 bg-teal-400 text-slate-900 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal-300 transition-colors"
          >
            <Plus size={16} />
            New Note
          </Link>
        </div>
      </div>

      {/* Current in-progress note (client-side only) */}
      {noteId ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Current Note</p>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-teal-400" />
              <div>
                <p className="text-sm font-medium text-slate-100">
                  {patientLabel || noteType.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-slate-400">{noteType.replace(/_/g, ' ')}</p>
              </div>
              <span className={
                status === 'finalized'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-400/30 text-xs px-2.5 py-1 rounded-full'
                  : 'bg-amber-950 text-amber-400 border border-amber-400/30 text-xs px-2.5 py-1 rounded-full'
              }>
                {status}
              </span>
            </div>
            <div className="flex gap-2">
              <Link
                to={`/scribe/note/${noteId}`}
                className="px-3 py-1.5 bg-teal-400 text-slate-900 font-semibold rounded-lg text-sm hover:bg-teal-300 transition-colors"
              >
                Open
              </Link>
              <button
                onClick={handleDiscard}
                className="px-3 py-1.5 border border-slate-600 text-slate-400 rounded-lg text-sm hover:text-red-400 hover:border-red-400/30 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-slate-400 text-base mb-2">No notes yet</p>
          <p className="text-slate-400 text-sm mb-4">Record your first patient encounter to get started</p>
          <Link to="/scribe/note/new" className="text-teal-400 hover:text-teal-300 text-sm transition-colors">
            Create first note →
          </Link>
        </div>
      )}

      {/* Mobile FAB */}
      <Link
        to="/scribe/note/new"
        aria-label="New Note"
        className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 bg-teal-400 text-slate-900 rounded-full shadow-[0_0_20px_rgba(45,212,191,0.25)] flex items-center justify-center hover:bg-teal-300 transition-all duration-150"
      >
        <Plus size={24} />
      </Link>
    </div>
  );
};
