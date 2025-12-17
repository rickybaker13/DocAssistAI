import { Observation } from '../../../types';

interface RecentLabsProps {
  labs: Observation[];
}

export default function RecentLabs({ labs }: RecentLabsProps) {
  const getLabName = (lab: Observation) => {
    return lab.code?.text ||
           lab.code?.coding?.[0]?.display ||
           'Unknown Lab';
  };

  const getValue = (lab: Observation) => {
    if (lab.valueQuantity) {
      return `${lab.valueQuantity.value} ${lab.valueQuantity.unit || ''}`;
    }
    if (lab.valueString) {
      return lab.valueString;
    }
    if (lab.valueCodeableConcept) {
      return lab.valueCodeableConcept.text || lab.valueCodeableConcept.coding?.[0]?.display;
    }
    return 'N/A';
  };

  const getDate = (lab: Observation) => {
    if (lab.effectiveDateTime) {
      return new Date(lab.effectiveDateTime).toLocaleDateString();
    }
    return 'Unknown date';
  };

  return (
    <div className="space-y-3">
      {labs.slice(0, 10).map((lab, index) => (
        <div key={lab.id || index} className="border-b border-gray-200 pb-3 last:border-b-0">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-gray-900">{getLabName(lab)}</p>
              <p className="text-sm text-gray-600 mt-1">{getDate(lab)}</p>
            </div>
            <p className="font-semibold text-gray-900">{getValue(lab)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

