import { AllergyIntolerance } from '../../../types';

interface AllergiesListProps {
  allergies: AllergyIntolerance[];
}

export default function AllergiesList({ allergies }: AllergiesListProps) {
  const getAllergenName = (allergy: AllergyIntolerance) => {
    return allergy.code?.text ||
           allergy.code?.coding?.[0]?.display ||
           'Unknown Allergen';
  };

  const getSeverity = (allergy: AllergyIntolerance) => {
    return allergy.criticality || 'unknown';
  };

  const getReaction = (allergy: AllergyIntolerance) => {
    const reaction = allergy.reaction?.[0];
    return reaction?.manifestation?.[0]?.text || 'Unknown reaction';
  };

  return (
    <div className="space-y-3">
      {allergies.map((allergy, index) => (
        <div key={allergy.id || index} className="border-b border-gray-200 pb-3 last:border-b-0">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-gray-900">{getAllergenName(allergy)}</p>
              <p className="text-sm text-gray-600 mt-1">Reaction: {getReaction(allergy)}</p>
            </div>
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              getSeverity(allergy) === 'high' || getSeverity(allergy) === 'critical'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}>
              {getSeverity(allergy)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

