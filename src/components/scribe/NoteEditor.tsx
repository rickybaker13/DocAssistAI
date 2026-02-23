import React from 'react';

interface Props {
  note: string;
  onChange: (value: string) => void;
  onCopy: () => void;
}

export const NoteEditor: React.FC<Props> = ({ note, onChange, onCopy }) => (
  <div className="flex flex-col gap-2">
    <div className="flex justify-between items-center">
      <h3 className="text-sm font-semibold text-gray-700">Generated Note</h3>
      <button
        onClick={onCopy}
        className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Copy to Clipboard
      </button>
    </div>
    <textarea
      value={note}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="Generated note will appear here..."
    />
  </div>
);
