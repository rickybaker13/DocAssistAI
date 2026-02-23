import React from 'react';

interface Domain {
  name: string;
  findings: string[];
  trend?: string;
}

const DOMAIN_ICONS: Record<string, string> = {
  hemodynamics: '❤️',
  respiratory: '🫁',
  renal: '🫘',
  infectious: '🦠',
  neuro: '🧠',
  lines_tubes_drains: '📌',
};

const TREND_COLORS: Record<string, string> = {
  improving: 'text-green-600',
  worsening: 'text-red-600',
  stable: 'text-gray-500',
  new: 'text-orange-500',
};

const TREND_ARROWS: Record<string, string> = {
  improving: '↑',
  worsening: '↓',
  stable: '→',
  new: '★',
};

export const SignalDomainCard: React.FC<{ domain: Domain }> = ({ domain }) => (
  <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-lg">{DOMAIN_ICONS[domain.name] || '📋'}</span>
      <span className="font-semibold text-gray-800 capitalize">{domain.name.replace(/_/g, ' ')}</span>
      {domain.trend && (
        <span className={`text-xs font-medium ml-auto flex items-center gap-1 ${TREND_COLORS[domain.trend] || 'text-gray-500'}`}>
          <span>{TREND_ARROWS[domain.trend]}</span>
          {domain.trend.toUpperCase()}
        </span>
      )}
    </div>
    <ul className="space-y-1">
      {domain.findings.map((f, i) => (
        <li key={i} className="text-sm text-gray-700 flex gap-2">
          <span className="text-gray-400 mt-0.5">•</span>
          <span>{f}</span>
        </li>
      ))}
    </ul>
  </div>
);
