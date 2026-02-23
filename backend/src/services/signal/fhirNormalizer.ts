export interface ClinicalEvent {
  timestamp: string;
  type: 'lab' | 'vital' | 'medication' | 'med_admin' | 'note' | 'diagnosis' | 'procedure' | 'report' | 'device';
  label: string;
  value?: string | number;
  unit?: string;
  referenceRange?: string;
  isAbnormal?: boolean;
  source: string;
}

export interface ClinicalTimeline {
  patientId: string;
  events: ClinicalEvent[];
  builtAt: string;
}

export class FhirNormalizer {
  normalize(data: any): ClinicalTimeline {
    const events: ClinicalEvent[] = [];

    (data.labs || []).forEach((obs: any) => {
      events.push({
        timestamp: obs.effectiveDateTime || obs.issued || new Date().toISOString(),
        type: 'lab',
        label: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown Lab',
        value: obs.valueQuantity?.value ?? obs.valueString ?? obs.valueCodeableConcept?.text,
        unit: obs.valueQuantity?.unit,
        referenceRange: obs.referenceRange?.[0]?.text,
        isAbnormal: obs.interpretation != null
          ? obs.interpretation[0]?.coding?.[0]?.code !== 'N'
          : undefined,
        source: obs.id || '',
      });
    });

    (data.vitals || []).forEach((obs: any) => {
      events.push({
        timestamp: obs.effectiveDateTime || obs.issued || new Date().toISOString(),
        type: 'vital',
        label: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown Vital',
        value: obs.valueQuantity?.value,
        unit: obs.valueQuantity?.unit,
        isAbnormal: obs.interpretation != null
          ? obs.interpretation[0]?.coding?.[0]?.code !== 'N'
          : undefined,
        source: obs.id || '',
      });
    });

    (data.medicationAdmins || []).forEach((ma: any) => {
      events.push({
        timestamp: ma.effectiveDateTime || ma.effectivePeriod?.start || new Date().toISOString(),
        type: 'med_admin',
        label: ma.medicationCodeableConcept?.text || ma.medicationCodeableConcept?.coding?.[0]?.display || 'Medication',
        value: ma.dosage?.dose?.value,
        unit: ma.dosage?.dose?.unit,
        source: ma.id || '',
      });
    });

    (data.diagnosticReports || []).forEach((dr: any) => {
      events.push({
        timestamp: dr.effectiveDateTime || dr.issued || new Date().toISOString(),
        type: 'report',
        label: dr.code?.text || dr.code?.coding?.[0]?.display || 'Report',
        value: dr.conclusion,
        source: dr.id || '',
      });
    });

    (data.conditions || []).forEach((c: any) => {
      if (c.clinicalStatus?.coding?.[0]?.code === 'active') {
        events.push({
          timestamp: c.onsetDateTime || c.recordedDate || new Date().toISOString(),
          type: 'diagnosis',
          label: c.code?.text || c.code?.coding?.[0]?.display || 'Condition',
          source: c.id || '',
        });
      }
    });

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      patientId: data.patient?.id || '',
      events,
      builtAt: new Date().toISOString(),
    };
  }
}
