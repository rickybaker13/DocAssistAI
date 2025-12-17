import { Condition } from '../../../types';

interface ConditionsListProps {
  conditions: Condition[];
}

export default function ConditionsList({ conditions }: ConditionsListProps) {
  const getConditionName = (condition: Condition) => {
    return condition.code?.text || 
           condition.code?.coding?.[0]?.display || 
           'Unknown Condition';
  };

  const getStatus = (condition: Condition) => {
    return condition.clinicalStatus?.coding?.[0]?.code || 'unknown';
  };

  const getOnsetDate = (condition: Condition) => {
    if (condition.onsetDateTime) {
      return new Date(condition.onsetDateTime).toLocaleDateString();
    }
    return 'Unknown';
  };

  return (
    <div className="space-y-3">
      {conditions.map((condition, index) => (
        <div key={condition.id || index} className="border-b border-gray-200 pb-3 last:border-b-0">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-gray-900">{getConditionName(condition)}</p>
              <p className="text-sm text-gray-600 mt-1">
                Onset: {getOnsetDate(condition)}
              </p>
            </div>
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              getStatus(condition) === 'active' 
                ? 'bg-red-100 text-red-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {getStatus(condition)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

