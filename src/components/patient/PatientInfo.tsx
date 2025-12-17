import { Patient } from '../../../types';

interface PatientInfoProps {
  patient: Patient;
}

export default function PatientInfo({ patient }: PatientInfoProps) {
  const getName = () => {
    const name = patient.name?.[0];
    if (!name) return 'Unknown';
    const given = name.given?.join(' ') || '';
    const family = name.family || '';
    return `${given} ${family}`.trim() || 'Unknown';
  };

  const getBirthDate = () => {
    if (!patient.birthDate) return 'Unknown';
    const date = new Date(patient.birthDate);
    return date.toLocaleDateString();
  };

  const getGender = () => {
    return patient.gender || 'Unknown';
  };

  const getMRN = () => {
    const identifier = patient.identifier?.find(id => 
      id.type?.coding?.[0]?.code === 'MR'
    );
    return identifier?.value || patient.id || 'N/A';
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Patient Information</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-600">Name</p>
          <p className="text-lg font-semibold text-gray-900">{getName()}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">MRN</p>
          <p className="text-lg font-semibold text-gray-900">{getMRN()}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Date of Birth</p>
          <p className="text-lg font-semibold text-gray-900">{getBirthDate()}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Gender</p>
          <p className="text-lg font-semibold text-gray-900">{getGender()}</p>
        </div>
      </div>
    </div>
  );
}

