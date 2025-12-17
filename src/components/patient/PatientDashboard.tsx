import { usePatientStore } from '../../stores/patientStore';
import LoadingSpinner from '../common/LoadingSpinner';
import PatientInfo from './PatientInfo';
import ConditionsList from './ConditionsList';
import MedicationsList from './MedicationsList';
import AllergiesList from './AllergiesList';
import RecentLabs from './RecentLabs';

export default function PatientDashboard() {
  const { patientSummary, isLoading } = usePatientStore();

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <LoadingSpinner message="Loading patient data..." />
      </div>
    );
  }

  if (!patientSummary) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">No patient data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Patient Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <PatientInfo patient={patientSummary.patient} />
      </div>

      {/* Conditions */}
      {patientSummary.conditions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Conditions</h2>
          <ConditionsList conditions={patientSummary.conditions} />
        </div>
      )}

      {/* Medications */}
      {patientSummary.medications.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Medications</h2>
          <MedicationsList medications={patientSummary.medications} />
        </div>
      )}

      {/* Allergies */}
      {patientSummary.allergies.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Allergies</h2>
          <AllergiesList allergies={patientSummary.allergies} />
        </div>
      )}

      {/* Recent Labs */}
      {patientSummary.recentLabs.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Laboratory Results</h2>
          <RecentLabs labs={patientSummary.recentLabs} />
        </div>
      )}
    </div>
  );
}

