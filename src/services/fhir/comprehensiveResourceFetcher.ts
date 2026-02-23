/**
 * Comprehensive Resource Fetcher
 * Fetches ALL available FHIR resources for a patient from Oracle Health/Cerner PowerChart
 * This helps understand the real structure and organization of EHR data
 */

import { Bundle } from '../types';
import { appConfig } from '../../config/appConfig';

export interface ResourceFetchResult {
  resourceType: string;
  count: number;
  resources: any[];
  success: boolean;
  error?: string;
  query?: string;
}

export interface ComprehensivePatientResources {
  patientId: string;
  fetchedAt: string;
  resources: {
    [resourceType: string]: ResourceFetchResult;
  };
  summary: {
    totalResourceTypes: number;
    totalResources: number;
    availableResources: string[];
    unavailableResources: string[];
  };
}

class ComprehensiveResourceFetcher {
  private baseUrl: string;

  constructor() {
    const configuredUrl = appConfig.fhirBaseUrl;
    if (configuredUrl && configuredUrl.includes('fhir-open.cerner.com')) {
      this.baseUrl = configuredUrl;
    } else {
      this.baseUrl = 'https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d';
    }
  }

  /**
   * Make a direct HTTP request to Open Sandbox
   */
  private async fetch<T>(resourcePath: string): Promise<T> {
    const url = `${this.baseUrl}/${resourcePath}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/fhir+json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`FHIR request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  /**
   * Fetch a resource type with error handling
   */
  private async fetchResourceType(
    resourceType: string,
    query: string
  ): Promise<ResourceFetchResult> {
    try {
      console.log(`[Resource Fetcher] Fetching ${resourceType} with query: ${query}`);
      const bundle = await this.fetch<Bundle>(query);
      const resources = (bundle.entry || []).map(entry => entry.resource);
      
      return {
        resourceType,
        count: resources.length,
        resources,
        success: true,
        query,
      };
    } catch (error: any) {
      console.warn(`[Resource Fetcher] Failed to fetch ${resourceType}:`, error.message);
      return {
        resourceType,
        count: 0,
        resources: [],
        success: false,
        error: error.message,
        query,
      };
    }
  }

  /**
   * Fetch ALL resources for a patient
   */
  async fetchAllResources(patientId: string): Promise<ComprehensivePatientResources> {
    console.log(`[Resource Fetcher] Starting comprehensive fetch for patient: ${patientId}`);
    
    const resourceQueries: Array<{ type: string; query: string }> = [
      // Core patient resources
      { type: 'Patient', query: `Patient/${patientId}` },
      
      // Clinical data
      { type: 'Condition', query: `Condition?patient=${patientId}&_sort=-date&_count=100` },
      { type: 'Observation', query: `Observation?patient=${patientId}&_sort=-date&_count=100` },
      { type: 'Observation-Vitals', query: `Observation?patient=${patientId}&category=vital-signs&_sort=-date&_count=100` },
      { type: 'Observation-Labs', query: `Observation?patient=${patientId}&category=laboratory&_sort=-date&_count=100` },
      
      // Medications
      { type: 'MedicationRequest', query: `MedicationRequest?patient=${patientId}&_sort=-date&_count=100` },
      { type: 'MedicationStatement', query: `MedicationStatement?patient=${patientId}&_sort=-date&_count=100` },
      { type: 'MedicationAdministration', query: `MedicationAdministration?patient=${patientId}&_sort=-date&_count=100` },
      
      // Encounters and episodes
      { type: 'Encounter', query: `Encounter?patient=${patientId}&_sort=-date&_count=100` },
      { type: 'EpisodeOfCare', query: `EpisodeOfCare?patient=${patientId}&_sort=-date&_count=100` },
      
      // Clinical notes - use 'subject' parameter (FHIR R4 standard)
      { type: 'DocumentReference', query: `DocumentReference?subject=Patient/${patientId}&_sort=-date&_count=100` },
      { type: 'DocumentReference-Status', query: `DocumentReference?subject=Patient/${patientId}&status=current&_sort=-date&_count=100` },
      { type: 'DocumentReference-Type', query: `DocumentReference?subject=Patient/${patientId}&type=&_sort=-date&_count=100` },
      
      // Communication resources
      { type: 'Communication', query: `Communication?subject=Patient/${patientId}&_sort=-sent&_count=100` },
      { type: 'Communication-Recipient', query: `Communication?recipient=Patient/${patientId}&_sort=-sent&_count=100` },
      
      // Diagnostic reports and imaging
      { type: 'DiagnosticReport', query: `DiagnosticReport?patient=${patientId}&_sort=-date&_count=100` },
      { type: 'DiagnosticReport-Lab', query: `DiagnosticReport?patient=${patientId}&category=LAB&_sort=-date&_count=100` },
      { type: 'DiagnosticReport-Imaging', query: `DiagnosticReport?patient=${patientId}&category=LAB&_sort=-date&_count=100` },
      { type: 'ImagingStudy', query: `ImagingStudy?patient=${patientId}&_sort=-started&_count=100` },
      
      // Procedures
      { type: 'Procedure', query: `Procedure?patient=${patientId}&_sort=-date&_count=100` },
      { type: 'ProcedureRequest', query: `ProcedureRequest?patient=${patientId}&_sort=-date&_count=100` },
      
      // Allergies and immunizations
      { type: 'AllergyIntolerance', query: `AllergyIntolerance?patient=${patientId}&_sort=-date&_count=100` },
      { type: 'Immunization', query: `Immunization?patient=${patientId}&_sort=-date&_count=100` },
      
      // Care planning
      { type: 'CarePlan', query: `CarePlan?patient=${patientId}&_sort=-date&_count=100` },
      { type: 'CarePlan-Active', query: `CarePlan?patient=${patientId}&status=active&_sort=-date&_count=100` },
      { type: 'Goal', query: `Goal?patient=${patientId}&_sort=-date&_count=100` },
      
      // Orders and requests
      { type: 'ServiceRequest', query: `ServiceRequest?patient=${patientId}&_sort=-date&_count=100` },
      { type: 'ServiceRequest-Active', query: `ServiceRequest?patient=${patientId}&status=active&_sort=-date&_count=100` },
      
      // Clinical impressions and assessments
      { type: 'ClinicalImpression', query: `ClinicalImpression?patient=${patientId}&_sort=-date&_count=100` },
      
      // Family history
      { type: 'FamilyMemberHistory', query: `FamilyMemberHistory?patient=${patientId}&_sort=-date&_count=100` },
      
      // Social history
      { type: 'Observation-Social', query: `Observation?patient=${patientId}&category=social-history&_sort=-date&_count=100` },
      
      // Specimens
      { type: 'Specimen', query: `Specimen?subject=Patient/${patientId}&_sort=-collected&_count=100` },
      
      // Related persons
      { type: 'RelatedPerson', query: `RelatedPerson?patient=${patientId}&_count=100` },
      
      // Coverage (insurance)
      { type: 'Coverage', query: `Coverage?beneficiary=Patient/${patientId}&_count=100` },
      
      // Explanation of Benefit
      { type: 'ExplanationOfBenefit', query: `ExplanationOfBenefit?patient=${patientId}&_sort=-created&_count=100` },
      
      // Claim
      { type: 'Claim', query: `Claim?patient=${patientId}&_sort=-created&_count=100` },
    ];

    // Fetch all resources in parallel
    const results = await Promise.all(
      resourceQueries.map(({ type, query }) => this.fetchResourceType(type, query))
    );

    // Organize results
    const resources: { [key: string]: ResourceFetchResult } = {};
    results.forEach(result => {
      resources[result.resourceType] = result;
    });

    // Calculate summary
    const availableResources = results.filter(r => r.success && r.count > 0).map(r => r.resourceType);
    const unavailableResources = results.filter(r => !r.success || r.count === 0).map(r => r.resourceType);
    const totalResources = results.reduce((sum, r) => sum + r.count, 0);

    const summary: ComprehensivePatientResources = {
      patientId,
      fetchedAt: new Date().toISOString(),
      resources,
      summary: {
        totalResourceTypes: resourceQueries.length,
        totalResources,
        availableResources,
        unavailableResources,
      },
    };

    console.log(`[Resource Fetcher] Completed fetch for patient ${patientId}:`);
    console.log(`  - Total resource types attempted: ${summary.summary.totalResourceTypes}`);
    console.log(`  - Available resource types: ${summary.summary.availableResources.length}`);
    console.log(`  - Total resources fetched: ${summary.summary.totalResources}`);
    console.log(`  - Available: ${summary.summary.availableResources.join(', ')}`);

    return summary;
  }

  /**
   * Get detailed analysis of DocumentReference resources (clinical notes)
   */
  analyzeDocumentReferences(documentRefs: any[]): {
    total: number;
    byType: { [type: string]: number };
    byStatus: { [status: string]: number };
    byCategory: { [category: string]: number };
    sampleStructures: any[];
  } {
    const byType: { [key: string]: number } = {};
    const byStatus: { [key: string]: number } = {};
    const byCategory: { [key: string]: number } = {};

    documentRefs.forEach(doc => {
      // Count by type
      const type = doc.type?.coding?.[0]?.display || doc.type?.text || 'Unknown';
      byType[type] = (byType[type] || 0) + 1;

      // Count by status
      const status = doc.status || 'Unknown';
      byStatus[status] = (byStatus[status] || 0) + 1;

      // Count by category
      if (doc.category && doc.category.length > 0) {
        doc.category.forEach((cat: any) => {
          const catName = cat.coding?.[0]?.display || cat.text || 'Unknown';
          byCategory[catName] = (byCategory[catName] || 0) + 1;
        });
      }
    });

    // Get sample structures (first 5)
    const sampleStructures = documentRefs.slice(0, 5).map(doc => ({
      id: doc.id,
      type: doc.type?.coding?.[0]?.display || doc.type?.text,
      status: doc.status,
      category: doc.category?.map((c: any) => c.coding?.[0]?.display || c.text),
      date: doc.date,
      author: doc.author?.[0]?.display,
      contentFormat: doc.content?.[0]?.attachment?.contentType,
      hasContent: !!doc.content?.[0]?.attachment?.data || !!doc.content?.[0]?.attachment?.url,
      structure: {
        hasType: !!doc.type,
        hasCategory: !!doc.category,
        hasContent: !!doc.content,
        contentCount: doc.content?.length || 0,
        hasAuthor: !!doc.author,
        authorCount: doc.author?.length || 0,
      },
    }));

    return {
      total: documentRefs.length,
      byType,
      byStatus,
      byCategory,
      sampleStructures,
    };
  }

  /**
   * Export resources to JSON for analysis
   */
  exportToJSON(resources: ComprehensivePatientResources): string {
    return JSON.stringify(resources, null, 2);
  }
}

export const comprehensiveResourceFetcher = new ComprehensiveResourceFetcher();

