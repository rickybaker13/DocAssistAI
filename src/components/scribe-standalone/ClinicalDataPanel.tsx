import React, { useEffect, useState } from 'react';
import { Loader2, Sparkles, Save, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { useEncounterForNote } from '../../hooks/useEncounterData';

interface Props {
  noteId: string;
  teamId: string | null;
  noteType: string;
  noteContent: string; // concatenated section content for extraction
}

export const ClinicalDataPanel: React.FC<Props> = ({ noteId, teamId, noteType, noteContent }) => {
  const { encounter, loading, extracting, fetchEncounter, extractFromNote, updateEncounter, saveManual } = useEncounterForNote(noteId, teamId);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  // Editable fields
  const [diagnosis, setDiagnosis] = useState('');
  const [codes, setCodes] = useState('');
  const [complications, setComplications] = useState('');
  const [interventions, setInterventions] = useState('');
  const [disposition, setDisposition] = useState('');
  const [scores, setScores] = useState<Record<string, string>>({});
  const [newScoreName, setNewScoreName] = useState('');
  const [newScoreValue, setNewScoreValue] = useState('');

  useEffect(() => { if (teamId) fetchEncounter(); }, [fetchEncounter, teamId]);

  // Populate form when encounter data loads
  useEffect(() => {
    if (encounter) {
      setDiagnosis(encounter.primary_diagnosis || '');
      setCodes((encounter.diagnosis_codes || []).join(', '));
      setComplications((encounter.complications || []).join(', '));
      setInterventions((encounter.interventions || []).join(', '));
      setDisposition(encounter.disposition || '');
      const scoreStrs: Record<string, string> = {};
      for (const [k, v] of Object.entries(encounter.acuity_scores || {})) {
        scoreStrs[k] = String(v);
      }
      setScores(scoreStrs);
    }
  }, [encounter]);

  if (!teamId) return null;

  const handleExtract = async () => {
    const result = await extractFromNote(noteContent, noteType);
    if (result) setExpanded(true);
  };

  const handleSave = async () => {
    const parsedScores: Record<string, number> = {};
    for (const [k, v] of Object.entries(scores)) {
      const num = parseFloat(v);
      if (!isNaN(num)) parsedScores[k] = num;
    }

    const fields = {
      primaryDiagnosis: diagnosis || undefined,
      diagnosisCodes: codes ? codes.split(',').map(s => s.trim()).filter(Boolean) : [],
      complications: complications ? complications.split(',').map(s => s.trim()).filter(Boolean) : [],
      interventions: interventions ? interventions.split(',').map(s => s.trim()).filter(Boolean) : [],
      disposition: disposition || undefined,
      acuityScores: parsedScores,
    };

    if (encounter) {
      await updateEncounter({
        primary_diagnosis: fields.primaryDiagnosis || null,
        diagnosis_codes: fields.diagnosisCodes,
        complications: fields.complications,
        interventions: fields.interventions,
        disposition: fields.disposition || null,
        acuity_scores: fields.acuityScores,
      } as any);
    } else {
      await saveManual(fields);
    }
    setEditing(false);
  };

  const addScore = () => {
    if (newScoreName.trim() && newScoreValue.trim()) {
      setScores(prev => ({ ...prev, [newScoreName.trim()]: newScoreValue.trim() }));
      setNewScoreName('');
      setNewScoreValue('');
    }
  };

  const removeScore = (key: string) => {
    setScores(prev => { const next = { ...prev }; delete next[key]; return next; });
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-slate-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-medium text-white">Clinical Data</span>
          {encounter && (
            <span className="text-xs text-slate-500">
              {encounter.primary_diagnosis || 'No diagnosis'}
              {encounter.source === 'auto_extracted' && ' · AI extracted'}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-slate-700 pt-3 space-y-3">
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-teal-400 animate-spin" /></div>
          ) : !encounter && !editing ? (
            <div className="text-center py-4">
              <p className="text-sm text-slate-500 mb-3">No clinical data captured for this note yet.</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleExtract}
                  disabled={extracting || noteContent.length < 50}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  AI Extract
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Manual Entry
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Display / Edit Mode */}
              {!editing && encounter ? (
                <div className="space-y-2">
                  {encounter.primary_diagnosis && (
                    <div><span className="text-xs text-slate-400">Diagnosis:</span> <span className="text-sm text-white">{encounter.primary_diagnosis}</span></div>
                  )}
                  {encounter.diagnosis_codes.length > 0 && (
                    <div><span className="text-xs text-slate-400">ICD-10:</span> <span className="text-sm text-teal-400 font-mono">{encounter.diagnosis_codes.join(', ')}</span></div>
                  )}
                  {Object.keys(encounter.acuity_scores).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(encounter.acuity_scores).map(([k, v]) => (
                        <span key={k} className="px-2 py-0.5 bg-slate-900 rounded text-xs text-slate-300">
                          {k}: <span className="text-amber-400 font-medium">{v}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {encounter.complications.length > 0 && (
                    <div><span className="text-xs text-slate-400">Complications:</span> <span className="text-sm text-red-400">{encounter.complications.join(', ')}</span></div>
                  )}
                  {encounter.interventions.length > 0 && (
                    <div><span className="text-xs text-slate-400">Interventions:</span> <span className="text-sm text-blue-400">{encounter.interventions.join(', ')}</span></div>
                  )}
                  {encounter.disposition && (
                    <div><span className="text-xs text-slate-400">Disposition:</span> <span className="text-sm text-white">{encounter.disposition}</span></div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditing(true)} className="text-xs text-teal-400 hover:underline">Edit</button>
                    <button
                      onClick={handleExtract}
                      disabled={extracting}
                      className="text-xs text-amber-400 hover:underline flex items-center gap-1"
                    >
                      {extracting && <Loader2 className="w-3 h-3 animate-spin" />} Re-extract
                    </button>
                  </div>
                </div>
              ) : (
                /* Edit Form */
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-0.5">Primary Diagnosis</label>
                    <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
                      placeholder="e.g., subarachnoid hemorrhage"
                      className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 placeholder-slate-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-0.5">ICD-10 Codes (comma-separated)</label>
                    <input value={codes} onChange={e => setCodes(e.target.value)}
                      placeholder="e.g., I60.9, G93.6"
                      className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 placeholder-slate-500 font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-0.5">Acuity Scores</label>
                    <div className="flex flex-wrap gap-1 mb-1">
                      {Object.entries(scores).map(([k, v]) => (
                        <span key={k} className="flex items-center gap-1 px-2 py-0.5 bg-slate-900 rounded text-xs text-slate-300">
                          {k}: {v}
                          <button onClick={() => removeScore(k)}><X className="w-3 h-3 text-slate-500 hover:text-red-400" /></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <input value={newScoreName} onChange={e => setNewScoreName(e.target.value)}
                        placeholder="Score name" className="flex-1 bg-slate-900 border border-slate-600 text-white text-xs rounded px-2 py-1 placeholder-slate-500" />
                      <input value={newScoreValue} onChange={e => setNewScoreValue(e.target.value)}
                        placeholder="Value" type="number" className="w-16 bg-slate-900 border border-slate-600 text-white text-xs rounded px-2 py-1 placeholder-slate-500" />
                      <button onClick={addScore} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs hover:bg-slate-600">Add</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-0.5">Complications (comma-separated)</label>
                    <input value={complications} onChange={e => setComplications(e.target.value)}
                      placeholder="e.g., VAP, DCI, CAUTI"
                      className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 placeholder-slate-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-0.5">Interventions (comma-separated)</label>
                    <input value={interventions} onChange={e => setInterventions(e.target.value)}
                      placeholder="e.g., intubation, EVD placement, CRRT"
                      className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 placeholder-slate-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-0.5">Disposition</label>
                    <select value={disposition} onChange={e => setDisposition(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500">
                      <option value="">Not set</option>
                      <option value="discharged">Discharged</option>
                      <option value="transferred_stepdown">Transferred to Stepdown</option>
                      <option value="transferred_floor">Transferred to Floor</option>
                      <option value="transferred_other">Transferred to Other Facility</option>
                      <option value="expired">Expired</option>
                      <option value="hospice">Hospice</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleSave}
                      className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-medium">
                      <Save className="w-3.5 h-3.5" /> Save
                    </button>
                    <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-slate-400 text-xs hover:text-white">Cancel</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
