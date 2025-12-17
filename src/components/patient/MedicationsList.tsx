import { MedicationRequest } from '../../../types';

interface MedicationsListProps {
  medications: MedicationRequest[];
}

export default function MedicationsList({ medications }: MedicationsListProps) {
  const getMedicationName = (med: MedicationRequest) => {
    return med.medicationCodeableConcept?.text ||
           med.medicationCodeableConcept?.coding?.[0]?.display ||
           'Unknown Medication';
  };

  const getDosage = (med: MedicationRequest) => {
    const dosage = med.dosageInstruction?.[0];
    if (!dosage) return 'N/A';
    
    const timing = dosage.timing?.repeat?.frequency 
      ? `${dosage.timing.repeat.frequency}x per ${dosage.timing.repeat.period || 'day'}`
      : '';
    
    const dose = dosage.doseAndRate?.[0]?.doseQuantity?.value 
      ? `${dosage.doseAndRate[0].doseQuantity.value} ${dosage.doseAndRate[0].doseQuantity.unit || ''}`
      : '';
    
    return `${dose} ${timing}`.trim() || 'N/A';
  };

  return (
    <div className="space-y-3">
      {medications.map((med, index) => (
        <div key={med.id || index} className="border-b border-gray-200 pb-3 last:border-b-0">
          <p className="font-medium text-gray-900">{getMedicationName(med)}</p>
          <p className="text-sm text-gray-600 mt-1">Dosage: {getDosage(med)}</p>
        </div>
      ))}
    </div>
  );
}

