# Cerner/Oracle Health SMART on FHIR Developer Setup Guide

**Complete step-by-step guide: Zero to Production**

---

## 1. Oracle Health Developer Account & Portal Access

### Create Oracle Health Developer Account

**URL:** https://developer.cerner.com/

**Steps:**

1. Go to https://developer.cerner.com/
2. Click **"Sign Up"** or **"Register"**
3. Fill in account details:
   - Email address
   - Password (strong password required)
   - Organization name
   - Role (Developer, IT, etc.)
   - Project description (SMART on FHIR clinical documentation app)
4. Verify email address
5. Log in to developer portal

### What You Get After Registration

**Developer Portal Access:**
- https://developer.cerner.com/
- Documentation for all Cerner APIs
- Sandbox management
- App registration & credentials
- API key management
- Rate limiting and quota info

**Key Dashboard Sections:**
1. **"My Applications"** — Register and manage your SMART apps
2. **"Sandbox Environments"** — Create/configure test instances
3. **"Documentation"** — API reference, FHIR specs, code samples
4. **"Integration"** — Connect to hospital systems
5. **"Support"** — Community forums, ticket system
6. **"Settings"** — API keys, webhooks, OAuth credentials

---

## 2. Cerner Sandbox & Synthetic Data Setup

### Sandbox Options

Cerner offers multiple testing environments:

**1. Public Sandbox (Free, No Registration)**
- URL: https://fhir-ehr-code.cerner.com/
- Data: Pre-populated with 50+ synthetic patients
- Purpose: Learning, proof-of-concept, testing basics
- Limitations: Limited functionality, shared environment

**2. Development Sandbox (Registered Developers)**
- Create in Developer Portal
- Fully isolated for your organization
- Customizable data sets
- Full EHR functionality
- URL: `https://fhir-open.sandboxcerner.com/` (varies by sandbox ID)

### Creating Your Development Sandbox

**In Developer Portal:**

1. Go to **"Sandboxes"** → **"Create New Sandbox"**

2. **Select Configuration:**
   ```
   Sandbox Type:      Millennium EHR (most common for hospitals)
   FHIR Version:      R4 (recommended) or DSTU2 (older, still supported)
   Modules:           
     ☑ Inpatient
     ☑ Outpatient
     ☑ Emergency Department
     ☑ Pharmacy
   ```

3. **Data Selection:**
   ```
   Patient Population:  Standard (100+ synthetic patients)
   Encounters:          3+ years of encounter history
   Clinical Data:       All standard clinical data included
   ```

4. **Submit and wait for provisioning** (10-30 minutes)

5. **Note your sandbox details:**
   ```
   Sandbox ID:         [Provided by Cerner]
   FHIR Base URL:      https://fhir-open.sandboxcerner.com/[SandboxID]/r4/
   OAuth2 Auth Server: https://authorization.sandboxcerner.com/
   ```

### What Synthetic Data You'll Have

Your sandbox includes:
- ✅ **100+ synthetic patients** with complete demographic data
- ✅ **Encounters:** Inpatient admissions, outpatient visits, ED visits, telehealth
- ✅ **Clinical notes:** Progress notes, discharge summaries, office notes
- ✅ **Problems:** Active diagnoses (Condition resources)
- ✅ **Medications:** Active and inactive medications
- ✅ **Lab results:** Complete with normal/abnormal flags
- ✅ **Vital signs:** Recorded at encounters
- ✅ **Imaging reports:** Radiology, ultrasound, etc.
- ✅ **Allergies & adverse reactions**
- ✅ **Care plans and goals**
- ✅ **Procedures and surgeries**

**HIPAA Safe:** All data is completely synthetic; no real patient information.

---

## 3. SMART on FHIR App Registration in Cerner

### Register Your Application

**In Developer Portal, go to "My Applications" → "Register New App"**

**Step 1: Application Details**

```
Application Name:       DocAssistAI
Description:            AI-powered clinical documentation assistance
Category:               Clinical Documentation
App Type:              SMART on FHIR (Standalone Launch preferred)
Organization:          [Your organization]
Support Email:         [Your email]
Maturity Level:        Development (move to Production later)
```

**Step 2: SMART Configuration**

```
SMART App Type:
  ☑ Standalone Launch (app launches outside EHR, gets patient context)
  ☐ EHR Launch (app launches from within EHR)
  
Include both if you want full flexibility
```

**Step 3: OAuth 2.0 Details**

Cerner will generate:
```
Client ID:              [Auto-generated, e.g., 0oa123abc...]
Client Secret:          [Keep this private!]

Redirect URI(s):        
  - http://localhost:8080/redirect (local dev)
  - http://localhost:3000/redirect (backend auth callback)
  - https://yourdomain.com/redirect (production)

Allowed Grant Types:    Authorization Code (required for SMART)
Token Endpoint Auth:    Client Secret Basic
```

**Step 4: FHIR & SMART Scopes**

Select required scopes:
```
✓ openid              # REQUIRED: OpenID Connect
✓ profile             # User profile info
✓ fhirUser            # Get authenticated user info
✓ launch              # For SMART launch flow
✓ offline_access      # Refresh tokens

Patient Data Scopes:
✓ patient/Patient.read           # Patient demographics
✓ patient/Encounter.read         # Visit information
✓ patient/Condition.read         # Problem list/diagnoses
✓ patient/Observation.read       # Labs, vitals, results
✓ patient/MedicationRequest.read # Medications
✓ patient/DocumentReference.read # Clinical notes
✓ patient/AllergyIntolerance.read # Allergies
✓ patient/Procedure.read         # Procedures
✓ patient/DiagnosticReport.read  # Diagnostic reports

User Data Scopes (if needed):
✓ user/Practitioner.read         # Provider info
✓ user/Organization.read         # Hospital/department info
```

**Step 5: FHIR Configuration**

```
FHIR Standard Version:  R4 (FHIR Release 4)
FHIR Base URL:          https://fhir-open.sandboxcerner.com/[SandboxID]/r4/
OAuth2 Server:          https://authorization.sandboxcerner.com/
```

**Step 6: Review & Submit**

- Check all details
- Accept terms of service
- Submit for registration
- Usually approved within 1 business day

---

## 4. Available FHIR Resources & API Endpoints

### Base URLs

**Sandbox FHIR:**
```
https://fhir-open.sandboxcerner.com/[SandboxID]/r4/
```

**Production FHIR (after hospital approval):**
```
https://fhir.cerner.com/[TenantID]/r4/
```

### Complete FHIR Resource Reference

| Resource | Endpoint | Example Query | Use Case |
|----------|----------|----------------|----------|
| **Patient** | `/Patient/{id}` | `GET /Patient/12345` | Demographics, contact |
| **Encounter** | `/Encounter` | `GET /Encounter?patient={id}&_sort=-date&_count=50` | Visit history |
| **Condition** | `/Condition` | `GET /Condition?patient={id}&clinical-status=active` | Active diagnoses |
| **Observation** | `/Observation` | `GET /Observation?patient={id}&category=vital-signs` | Labs, vitals |
| **DiagnosticReport** | `/DiagnosticReport` | `GET /DiagnosticReport?patient={id}&category=laboratory` | Lab/imaging reports |
| **MedicationRequest** | `/MedicationRequest` | `GET /MedicationRequest?patient={id}&status=active` | Active medications |
| **DocumentReference** | `/DocumentReference` | `GET /DocumentReference?patient={id}&type=clinical-note` | Clinical notes |
| **AllergyIntolerance** | `/AllergyIntolerance` | `GET /AllergyIntolerance?patient={id}` | Allergies |
| **Procedure** | `/Procedure` | `GET /Procedure?patient={id}&date=ge2024-01-01` | Past procedures |
| **CarePlan** | `/CarePlan` | `GET /CarePlan?patient={id}&status=active` | Treatment plans |
| **Immunization** | `/Immunization` | `GET /Immunization?patient={id}` | Vaccine records |
| **MedicationStatement** | `/MedicationStatement` | `GET /MedicationStatement?patient={id}` | Historical meds |

### Example API Calls

**1. Get Patient Demographics**

```bash
curl -H "Authorization: Bearer [access_token]" \
  https://fhir-open.sandboxcerner.com/[SandboxID]/r4/Patient/12345

# Response:
{
  "resourceType": "Patient",
  "id": "12345",
  "identifier": [{
    "type": { "coding": [{ "code": "MR" }] },
    "value": "00000001"
  }],
  "name": [{ "given": ["John"], "family": "Doe" }],
  "telecom": [{ "system": "phone", "value": "555-1234" }],
  "birthDate": "1985-06-15",
  "address": [{ "line": ["123 Main St"], "city": "Boston", "state": "MA" }]
}
```

**2. Get Patient's Recent Encounters**

```bash
curl -H "Authorization: Bearer [access_token]" \
  "https://fhir-open.sandboxcerner.com/[SandboxID]/r4/Encounter?patient=12345&_sort=-date&_count=10"

# Returns: Bundle with 10 most recent encounters
```

**3. Get Clinical Notes for Specific Encounter**

```bash
curl -H "Authorization: Bearer [access_token]" \
  "https://fhir-open.sandboxcerner.com/[SandboxID]/r4/DocumentReference?patient=12345&encounter=[EncounterId]&type=http://snomed.info/sct|11488"

# Returns: Clinical notes associated with that encounter
```

**4. Get Active Medications**

```bash
curl -H "Authorization: Bearer [access_token]" \
  "https://fhir-open.sandboxcerner.com/[SandboxID]/r4/MedicationRequest?patient=12345&status=active&_count=50"

# Returns: List of active medication orders
```

**5. Get Labs and Vitals**

```bash
curl -H "Authorization: Bearer [access_token]" \
  "https://fhir-open.sandboxcerner.com/[SandboxID]/r4/Observation?patient=12345&category=laboratory,vital-signs&_sort=-date&_count=100"
```

---

## 5. Cerner SDKs & Sample Code

### JavaScript/TypeScript

**FHIR Client Library (same as Epic):**

```bash
npm install fhirclient
```

**SMART Launch in Cerner:**

```typescript
import { fhir } from 'fhirclient';

// Initialize SMART launch (Cerner-compatible)
const client = await fhir.oauth2.ready();

const patientId = client.patient.id;
const encounterId = client.encounter?.id;

// Fetch patient data
const patient = await client.request(`Patient/${patientId}`);
console.log(`Patient: ${patient.name[0].given} ${patient.name[0].family}`);

// Fetch recent encounters
const encounters = await client.request({
  url: `Encounter?patient=${patientId}&_sort=-date&_count=10`,
  flat: true
});
```

### Python

**FHIR Client Library:**

```bash
pip install fhirclient requests
```

**Cerner OAuth2 Flow:**

```python
import requests
import json

# Step 1: User clicks "Login with Cerner"
# You redirect to Cerner's authorization endpoint

auth_url = "https://authorization.sandboxcerner.com/oauth/authorize"
params = {
    'client_id': CLIENT_ID,
    'redirect_uri': REDIRECT_URI,
    'scope': 'openid fhirUser launch patient/*.read',
    'response_type': 'code',
    'state': generate_random_state()
}

# User logs in and grants permission...
# They're redirected back to your REDIRECT_URI with ?code=...

# Step 2: Exchange authorization code for access token
auth_code = request.args.get('code')

token_response = requests.post(
    'https://authorization.sandboxcerner.com/oauth/token',
    data={
        'grant_type': 'authorization_code',
        'code': auth_code,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'redirect_uri': REDIRECT_URI
    },
    auth=(CLIENT_ID, CLIENT_SECRET)
)

access_token = token_response.json()['access_token']

# Step 3: Use access token to fetch FHIR data
fhir_headers = {'Authorization': f'Bearer {access_token}'}

patient_resp = requests.get(
    f'https://fhir-open.sandboxcerner.com/[SandboxID]/r4/Patient/{patient_id}',
    headers=fhir_headers
)

patient_data = patient_resp.json()
print(f"Patient: {patient_data['name'][0]['given']} {patient_data['name'][0]['family']}")
```

### Sample Code Repositories

Cerner provides samples:
- **Cerner Code:** https://code.cerner.com/ (public sandbox + samples)
- **FHIR Documentation:** https://fhir.cerner.com/
- **GitHub Samples:** Search for `cerner-smart-on-fhir` or `cerner-fhir-examples`

---

## 6. Sandbox → Production: Hospital Deployment

### Phase 1: Sandbox Development (Current Phase)
- ✅ Build locally using Cerner sandbox
- ✅ Test SMART launch flow
- ✅ Validate FHIR API integration
- ✅ Implement audit logging & compliance controls

### Phase 2: Hospital Selection & Onboarding
- Hospital IT evaluates your app
- Hospital sets up instance for you in their **production environment**
- You get credentials for hospital's FHIR endpoint
- Hospital provides test users and test patient data

### Phase 3: Hospital Testing (3-8 weeks typical)
- Install app in hospital's EHR
- Test with hospital's real EHR configuration
- Hospital conducts:
  - Security audit/penetration testing
  - HIPAA compliance review
  - Performance testing under load
  - User acceptance testing (clinicians test it)

### Phase 4: Go-Live Approval
- Hospital approves for production use
- You sign **Business Associate Agreement (BAA)** with hospital
- Hospital enables app for real patient data
- 24/7 support requirements typically start

### Phase 5: Post-Live Support
- Monitor error rates and performance
- Hospital may report issues
- You provide updates/patches as needed
- Document SLAs (Service Level Agreements)

---

## 7. Costs, Certifications, Compliance

### Costs

| Item | Cost | Notes |
|------|------|-------|
| Cerner Developer Account | **FREE** | Sandbox access, development |
| Development Sandboxes | **FREE** | Up to 3-5 per account |
| Hospital Integration Fee | **$10K - $100K+** | Varies by hospital size and complexity |
| Annual Maintenance | **$5K - $20K** | If hospital requires annual contract |
| Certification (optional) | **$2K - $10K** | Not usually required by hospitals |

**Real-world example:**
- Solo startup, one hospital: ~$15,000 integration
- Enterprise deployment, 10 hospitals: $200,000+

### Compliance Requirements

**Minimum Required:**

```
☐ HIPAA Business Associate Agreement (hospital provides)
☐ HIPAA-compliant audit logging
  - Log all data access with timestamp, user, patient, action
☐ Encryption in transit (TLS 1.2+, HTTPS)
☐ Encryption at rest (if storing patient data)
☐ User authentication & authorization
☐ Session management (timeout, logout)
☐ Secure credential handling (no API keys in frontend)
☐ PHI de-identification before sending to external AI
☐ Incident response procedures
☐ Data retention/deletion policies
☐ Documentation of security controls
```

**Optional but Recommended:**
- 📋 **ONC Health IT Certification** (if you're commercializing the app)
- 📋 **SOC 2 Type II Report** (demonstrates security maturity; $5K-15K for audit)
- 📋 **HIPAA Risk Assessment** (documentation of security measures; can DIY)

### Compliance Checklist for Your App

```
SMART on FHIR & OAuth2:
☐ Using SMART on FHIR libraries correctly
☐ Handling token expiration and refresh
☐ Storing client secrets securely (not in code)
☐ Validating SSL certificates

Data Handling:
☐ De-identifying before AI processing (remove MRN, DOB, names)
☐ Not storing raw patient data locally
☐ Logging all API calls
☐ Handling errors without exposing sensitive info

HIPAA:
☐ User authentication on app login
☐ Session timeout after inactivity (30 min recommended)
☐ Audit logging with timestamp, user, patient, action
☐ Encryption TLS 1.2+ in transit
☐ Clear data retention policy

Hospital Integration:
☐ Hospital security team review completed
☐ BAA signed by hospital legal
☐ Support contact information documented
☐ SLAs agreed upon
```

---

## 8. Common Gotchas & Pitfalls

### 🚨 Critical Gotchas

**1. R4 vs DSTU2 Confusion**
- **Problem:** Cerner supports both FHIR versions; endpoints differ
- **Fix:** Confirm with hospital which version they use; R4 is preferred

**2. Tenant ID vs Organization ID**
- **Problem:** Multiple IDs used in Cerner; easy to confuse
- **Fix:** Hospital IT will provide exact endpoint URL; don't guess

**3. Access Token Expiration**
- **Problem:** Tokens expire after 30-60 min; many developers ignore this
- **Fix:** Implement refresh token rotation; catch 401 errors

**4. No Patient Context in Standalone Launch**
- **Problem:** If user launches app without EHR context, `client.patient.id` is null
- **Fix:** Implement patient search/selection screen as fallback

**5. Sending Raw PHI to Cloud AI**
- **Problem:** HIPAA violation if you send patient names, MRNs, DOBs to OpenAI
- **Fix:** Scrub identifiers before AI processing; create de-identified summaries

### 🔧 Implementation Gotchas

**6. FHIR Search Pagination**
- **Problem:** Requests return paginated results; developers miss additional pages
- **Fix:** Check for `next` link in response; loop through all pages

**7. Cerner-Specific FHIR Extensions**
- Cerner adds proprietary extensions (e.g., `conservedNursing`, `cciCode`)
- Might break standard FHIR parsers
- **Fix:** Handle gracefully; don't assume all extensions are standard

**8. Encounter Boundaries**
- Labs/vitals may have different encounter IDs than the note
- **Fix:** Query by patient across multiple encounters; don't assume single encounter

**9. Medication Reconciliation**
- Cerner tracks MedicationRequest + MedicationStatement + MedicationAdministration
- Different statuses (active, completed, stopped) are tricky
- **Fix:** Understand Cerner's medication workflow; test thoroughly

**10. Practitioner Authorization**
- May need to log in as specific clinician; Cerner tracks user context
- Different clinicians see different data
- **Fix:** Respect Cerner's role-based access control; don't bypass

**11. Production URL Structure Changes**
- Sandbox URL: `fhir-open.sandboxcerner.com/[SandboxID]/r4/`
- Production URL: `fhir.cerner.com/[TenantID]/r4/`
- They're different; easy to hardcode wrong one
- **Fix:** Make FHIR base URL configurable via environment variables

**12. Rate Limiting**
- Cerner has rate limits (typically 100 req/min per client)
- No error message; requests just fail
- **Fix:** Implement exponential backoff; cache results when possible

---

## 9. Quick Reference: URLs & Links

| Resource | URL |
|----------|-----|
| Cerner Developer Portal | https://developer.cerner.com/ |
| Register New App | https://developer.cerner.com/applications |
| Public Sandbox (Free) | https://fhir-ehr-code.cerner.com/ |
| Cerner Code Open Sandbox | https://code.cerner.com/apps |
| FHIR Documentation | https://fhir.cerner.com/ |
| OAuth Authorization Server | https://authorization.sandboxcerner.com/ (sandbox) |
| fhirclient.js Library | https://github.com/smart-on-fhir/client-js |
| SMART on FHIR Specs | http://hl7.org/fhir/smart-app-launch/ |
| Cerner Support Forums | https://code.cerner.com/community |

---

## 10. Next Steps for DocAssistAI

### Immediate (This Week)
- [ ] Create Cerner Developer account at https://developer.cerner.com/
- [ ] Create development sandbox
- [ ] Register DocAssistAI as SMART app
- [ ] Get Client ID and Client Secret
- [ ] Update `.env` files with sandbox FHIR URL

### Short-term (Next 2 weeks)
- [ ] Test SMART launch flow
- [ ] Fetch and display patient data
- [ ] Implement de-identification for AI calls
- [ ] Complete audit logging

### Medium-term (Next month)
- [ ] Identify target hospital
- [ ] Hospital IT evaluation
- [ ] Security testing
- [ ] Compliance review

### Long-term (Production)
- [ ] Hospital deployment
- [ ] Real patient data handling
- [ ] 24/7 support setup
- [ ] Ongoing maintenance

---

## 11. Epic vs Cerner: Quick Comparison

| Aspect | Epic | Cerner |
|--------|------|--------|
| **Developer Platform** | App Orchard | Developer Portal |
| **FHIR Version** | R4 preferred | R4 or DSTU2 |
| **Sandbox URL Format** | `sandbox-[ID].epic.com` | `fhir-open.sandboxcerner.com/[ID]` |
| **OAuth Server** | Built-in | authorization.sandboxcerner.com |
| **Authentication** | Client Secret Basic/Post | Client Secret Basic |
| **Refresh Tokens** | 3 months | Varies |
| **Rate Limiting** | Generous | 100 req/min |
| **Integration Fee** | Variable | Variable |
| **Adoption** | ~40% of US hospitals | ~25% of US hospitals |
| **Ease of Sandbox Setup** | 15-30 min | 10-20 min |
| **Hospital Compliance Review** | Typical: 4-8 weeks | Typical: 3-8 weeks |

---

**Status:** ✅ Both guides complete. Review in morning!
