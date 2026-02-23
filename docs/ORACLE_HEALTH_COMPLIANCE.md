# Oracle Health Millennium Platform Compliance

This document tracks our compliance with Oracle Health Millennium Platform APIs and best practices.

## Documentation References

- [Oracle Health Millennium Platform APIs](https://docs.oracle.com/en/industries/health/millennium-platform-apis/index.html)
- [Authorization Framework](https://docs.oracle.com/en/industries/health/millennium-platform-apis/millennium-authorization-framework/#authorization)
- [FHIR R4 APIs](https://docs.oracle.com/en/industries/health/millennium-platform-apis/mfrap/r4_overview.html)
- [SMART Applications](https://docs.oracle.com/en/industries/health/millennium-platform-apis/smart-applications.html)

## Compliance Checklist

### ✅ FHIR Version
- [x] Using FHIR R4 (not deprecated DSTU 2)
- [x] FHIR Base URL format: `https://fhir-ehr-code.cerner.com/r4/{tenant-id}`
- [x] All resource queries use R4 syntax

### ✅ Authorization Framework
- [x] SMART on FHIR authentication implemented
- [x] Using `/.well-known/smart-configuration` for endpoint discovery
- [x] PKCE (Proof Key for Code Exchange) supported
- [x] OAuth 2.0 compliant authorization flow
- [x] Proper scope requests (`patient/*.read`, `patient/*.write`, `user/*.read`, `offline_access`)
- [x] Application registered in Oracle Health Code Console

### ✅ FHIR R4 Resources
- [x] Patient
- [x] Condition
- [x] Observation (vitals, labs)
- [x] MedicationRequest
- [x] Encounter
- [x] DiagnosticReport
- [x] Procedure
- [x] AllergyIntolerance
- [x] Immunization
- [x] CarePlan
- [x] DocumentReference
- [x] Communication
- [x] ServiceRequest

### ✅ SMART Application Requirements
- [x] SMART App Launch 2.0.0 (STU2) compliant
- [x] Supports EHR Launch
- [x] Supports Standalone Launch
- [x] Proper launch context extraction (patient, encounter, user)
- [x] Token refresh handling (`offline_access` scope)

### ✅ Security & Best Practices
- [x] HTTPS/TLS for all API calls
- [x] Secure token storage (sessionStorage, not localStorage)
- [x] Proper error handling for expired tokens
- [x] PHI protection and HIPAA compliance considerations
- [x] Audit logging (backend)

### ✅ Development & Testing
- [x] Mock data mode for local development
- [x] Oracle Health sandbox testing capability
- [x] Test launcher for standalone launch testing
- [x] Proper redirect URI handling

## Implementation Details

### Authorization Flow

Our implementation follows Oracle Health's recommended approach:

1. **Discovery**: Uses `/.well-known/smart-configuration` endpoint discovery
2. **Authorization**: Uses `fhirclient` library which handles:
   - PKCE code challenge generation
   - Authorization URL construction
   - Token exchange
   - Token refresh

### FHIR API Usage

- **Base URL**: `https://fhir-ehr-code.cerner.com/r4/{tenant-id}`
- **Authentication**: Bearer token in `Authorization` header
- **Content-Type**: `application/fhir+json`
- **Query Parameters**: Standard FHIR search parameters (`_sort`, `_count`, `patient`, etc.)

### Resource Queries

All queries follow FHIR R4 search syntax:
- Patient-scoped: `ResourceType?patient={patientId}&_sort=-date`
- Category filtering: `Observation?patient={patientId}&category=vital-signs`
- Status filtering: `MedicationRequest?patient={patientId}&status=active`

## Known Limitations

1. **Bulk Data Access**: Not yet implemented (future enhancement)
2. **FHIR DSTU 2**: Not supported (intentionally, as it's deprecated)
3. **EHR APIs**: Currently using FHIR APIs only (EHR APIs require different authorization)

## Migration Notes

### From DSTU 2 to R4
- ✅ Already using R4 (no migration needed)
- ✅ All resource types compatible with R4
- ✅ No deprecated DSTU 2 endpoints

### Future Enhancements
- [ ] Bulk Data Access API support
- [ ] FHIR R4 Public Endpoints (for patient-facing features)
- [ ] Multi-tenant domain support
- [ ] Advanced SMART features (Backend Services)

## Testing with Oracle Health Sandbox

### Sandbox Configuration
- **Tenant ID**: `ec2458f2-1e24-41c8-b71b-0e701af7583d`
- **FHIR Base URL**: `https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d`
- **Auth Base URL**: `https://authorization.cerner.com`
- **Code Console**: https://code-console.cerner.com/

### Test Patient IDs
- Test patient IDs available in sandbox documentation
- Use sandbox EHR to launch app with patient context

## Compliance Status

**Overall Status**: ✅ **COMPLIANT**

- All critical requirements met
- Following Oracle Health best practices
- Using recommended libraries and approaches
- Proper error handling and security measures

## References

- [Oracle Health Developer Forums](https://forums.oracle.com/ords/apexds/domain/dev-community) - For support and updates
- [FHIR R4 Specification](https://www.hl7.org/fhir/R4/) - HL7 FHIR standard
- [SMART App Launch](http://hl7.org/fhir/smart-app-launch/) - SMART specification

---

**Last Updated**: December 2024
**Oracle Health API Version**: R4
**SMART Version**: 2.0.0 (STU2)

