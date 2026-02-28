import axios from 'axios';
import { ICUPatientData } from '../../types';
import { getBackendUrl } from '../../config/appConfig';

const BASE = getBackendUrl();

export const signalService = {
  async process(patientData: ICUPatientData, hoursBack: number, sessionId: string) {
    const res = await axios.post(`${BASE}/api/signal/process`, { patientData, hoursBack }, {
      headers: {
        'X-Patient-Id': patientData.patient.id || '',
        'X-Session-Id': sessionId,
      },
    });
    return res.data.signal;
  },
};
