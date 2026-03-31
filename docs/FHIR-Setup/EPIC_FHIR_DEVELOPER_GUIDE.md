# Epic SMART on FHIR Developer Setup Guide

**Complete step-by-step guide: Zero to Production**

---

## 1. Epic Developer Account & App Orchard Access

### Sign Up for Epic Developer Account

**URL:** https://apporchard.epic.com/

**Steps:**
1. Go to https://apporchard.epic.com/
2. Click **"Sign Up for a Developer Account"**
3. Fill in:
   - Name, email, organization
   - Your role (Developer, Clinician, IT, etc.)
   - Organization type
   - Project description (mention SMART on FHIR clinical documentation app)
4. Verify email
5. Log in to App Orchard dashboard

**What you get:**
- Developer account on Epic's App Orchard portal
- Access to documentation, sandbox environments, and app registration tools
- API keys and credentials management
- Testing and deployment workflows

### Access Epic App Orchard

**Dashboard:** https://apporchard.epic.com/dashboard

**Key sections:**
- **My Apps** — Register and manage your applications
- **Documentation** — FHIR specs, API references, best practices
- **Sandbox** — Test environments with synthetic data
- **Hospital Connections** — Connect to live hospital systems (after approval)
- **Support** — Developer community, issue tracking

---

## 2. Epic Sandbox & Synthetic Data Setup

### Available Sandbox Environments

Epic provides **multiple sandbox instances** with pre-loaded synthetic patient data:

**Sandbox instances:**
1. **Training/Public Sandboxes** (no registration required for learning)
   - URL: `https://open.epic.com/` (demo instance)
   - Data: Pre-populated with 500+ synthetic patients
   - Purpose: Learning, proof-of-concept

2. **Private Sandboxes** (for registered developers)
   - Create in App Orchard
   - Fully isolated environment
   - Customizable synthetic data
   - URL: Specific to your sandbox instance (provided upon creation)

### Setting Up Your Private Sandbox

**In App Orchard Dashboard:**
1. Go to **"Environments"** or **"Sandboxes"**
2. Click **"Create New Sandbox"**
3. Choose:
   - Sandbox type: "FHIR/SMART Sandbox" (FHIR R4)
   - Configuration: Full EHR (Inpatient + Outpatient)
   - Data: Epic's standard synthetic patient set (includes 50+ patients with complete histories)
4. Wait for provisioning (usually 15-30 minutes)
5. Note your sandbox FHIR endpoint: `https://sandbox-[ID].epic.com/api/FHIR/R4/`

### Synthetic Data Available

Your sandbox includes:
- ✅ 50-100 synthetic patients with complete demographics
- ✅ Encounters (inpatient admissions, outpatient visits, ED visits)
- ✅ Clinical notes (progress notes, discharge summaries)
- ✅ Problems/Conditions (diagnoses)
- ✅ Active medications
- ✅ Lab results and imaging reports
- ✅ Vital signs
- ✅ Allergies

**No real patient data is used.**

---

## 3. SMART on FHIR App Registration

### Register Your App in App Orchard

**Process:**

1. **In App Orchard, go to "My Apps" → "Register New App"**

2. **Fill in Application Details:**
   ```
   App Name:              DocAssistAI
   App Type:              SMART on FHIR Application
   Category:              Clinical Documentation / Note Generation
   Description:           AI-powered clinical documentation assistance app
   Organization:          [Your Name/Organization]
   Website:               [Your site if public]
   ```

3. **OAuth 2.0 Configuration:**
   
   ```
   Client ID:              [Epic generates this]
   Client Secret:          [Epic generates this - keep private!]
   
   Grant Types:            Authorization Code (required for SMART)
   
   Redirect URI(s):        http://localhost:8080/redirect (for local dev)
                          https://yourdomain.com/redirect (for production)
   
   SMART App Launch:       Enabled (check this box)
   ```

4. **FHIR Configuration:**
   ```
   FHIR Standard:          R4 (FHIR Release 4)
   Sandbox FHIR URL:       https://sandbox-[ID].epic.com/api/FHIR/R4/
   Production FHIR URL:    https://fhir.epic.com/api/FHIR/R4/ (after approval)
   ```

5. **Required SMART Scopes:**
   ```
   openid                  # Required for SMART auth
   fhirUser               # Get user info
   launch                 # For EHR launch flow
   patient/*.read         # Read all patient resources
   patient/*.write        # Write capability (optional)
   offline_access         # Refresh tokens
   
   Specific scopes for your app:
   patient/Patient.read
   patient/Encounter.read
   patient/Condition.read
   patient/Observation.read
   patient/MedicationRequest.read
   patient/DocumentReference.read
   ```

6. **Submit for Registration**
   - Epic reviews (usually 1-3 business days)
   - You'll receive confirmation with Client ID and Client Secret

### Update Your DocAssistAI Config

Update `.env` in your DocAssistAI frontend:

```env
VITE_FHIR_BASE_URL=https://sandbox-[YOUR-ID].epic.com/api/FHIR/R4
VITE_CLIENT_ID=[Epic-provided-Client-ID]
VITE_REDIRECT_URI=http://localhost:8080/redirect
VITE_AUTH_BASE_URL=https://sandbox-[YOUR-ID].epic.com
```

Update backend `.env`:

```env
EPIC_CLIENT_SECRET=[Epic-provided-Client-Secret]  # Never in frontend
EPIC_SANDBOX_URL=https://sandbox-[YOUR-ID].epic.com
```

---

## 4. Available FHIR Resources & API Endpoints

### Base URL
```
https://sandbox-[YOUR-ID].epic.com/api/FHIR/R4/
```

### Patient Data You Can Pull

| Data Type | FHIR Resource | Endpoint | Use Case |
|-----------|---------------|----------|----------|
| **Patient Info** | Patient | `GET /Patient/{id}` | Demographics, DOB, contact |
| **Encounters** | Encounter | `GET /Encounter?patient={id}&_sort=-date` | Visit history, dates, types |
| **Diagnoses** | Condition | `GET /Condition?patient={id}` | Active problems, ICD codes |
| **Vital Signs** | Observation | `GET /Observation?patient={id}&category=vital-signs` | BP, HR, Temp, RR, O2 sat |
| **Lab Results** | Observation | `GET /Observation?patient={id}&category=laboratory` | Blood work, urine tests |
| **Imaging** | DiagnosticReport | `GET /DiagnosticReport?patient={id}&category=imaging` | X-rays, CT, MRI reports |
| **Medications** | MedicationRequest | `GET /MedicationRequest?patient={id}&status=active` | Current meds, dosage, frequency |
| **Clinical Notes** | DocumentReference | `GET /DocumentReference?patient={id}` | Progress notes, discharge summaries |
| **Allergies** | AllergyIntolerance | `GET /AllergyIntolerance?patient={id}` | Drug/food allergies, reactions |
| **Care Plans** | CarePlan | `GET /CarePlan?patient={id}&status=active` | Treatment goals, instructions |
| **Procedures** | Procedure | `GET /Procedure?patient={id}` | Past and upcoming procedures |
| **Immunizations** | Immunization | `GET /Immunization?patient={id}` | Vaccine history |

### Example: Fetch Patient Demographics

```bash
curl -H "Authorization: Bearer [access_token]" \
  https://sandbox-[ID].epic.com/api/FHIR/R4/Patient/eNnbFNSxGYUwH

# Response includes:
{
  "resourceType": "Patient",
  "id": "eNnbFNSxGYUwH",
  "name": [{
    "given": ["John"],
    "family": "Doe"
  }],
  "birthDate": "1985-06-15",
  "telecom": [...],
  "address": [...]
}
```

### Example: Fetch Recent Encounters

```bash
curl -H "Authorization: Bearer [access_token]" \
  "https://sandbox-[ID].epic.com/api/FHIR/R4/Encounter?patient=eNnbFNSxGYUwH&_sort=-date&_count=10"

# Returns list of encounters ordered by date (newest first)
```

### Example: Fetch Clinical Notes

```bash
curl -H "Authorization: Bearer [access_token]" \
  "https://sandbox-[ID].epic.com/api/FHIR/R4/DocumentReference?patient=eNnbFNSxGYUwH&_sort=-date"

# Returns: List of clinical documents with links to content
```

---

## 5. Epic SDKs & Sample Code

### JavaScript/TypeScript

**Official FHIR Client Library (used in your DocAssistAI):**
```bash
npm install fhirclient
```

**SMART Launch Example:**
```typescript
import { fhir } from 'fhirclient';

// This is already in your DocAssistAI!
const client = await fhir.oauth2.ready();
const patient = await client.request(`Patient/${client.patient.id}`);
```

**Fetch Encounter Data:**
```typescript
const encounters = await client.request({
  url: `Encounter?patient=${client.patient.id}&_sort=-date`,
  flat: true  // Flattens results array
});

encounters.forEach(enc => {
  console.log(`${enc.period.start} - ${enc.type[0].text}`);
});
```

### Python

**FHIR Libraries:**
```bash
pip install fhirclient
pip install requests  # For direct HTTP calls
```

**OAuth2 Flow in Python:**
```python
import requests
from datetime import datetime

# Get access token
auth_response = requests.post(
    'https://sandbox-[ID].epic.com/oauth2/token',
    data={
        'grant_type': 'authorization_code',
        'code': authorization_code,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'redirect_uri': REDIRECT_URI
    }
)

access_token = auth_response.json()['access_token']

# Fetch patient data
headers = {'Authorization': f'Bearer {access_token}'}
patient_resp = requests.get(
    f'https://sandbox-[ID].epic.com/api/FHIR/R4/Patient/{patient_id}',
    headers=headers
)
patient_data = patient_resp.json()
```

### Sample Code Repositories

Epic provides sample SMART apps on GitHub:
- **Epic SMART on FHIR Samples:** https://github.com/epic-systems/
- Look for: `smart-on-fhir-tutorials`, `fhirworks-javascript`, etc.

---

## 6. Sandbox → Production: Hospital Deployment

### Phase 1: Sandbox Testing (You are here)
- ✅ Develop locally with mock/synthetic data
- ✅ Register app in App Orchard
- ✅ Test SMART launch and FHIR API calls
- ✅ Validate HIPAA compliance (audit logging, PHI handling)

### Phase 2: Hospital Sandbox Testing
- Hospital IT installs your app in **their sandbox**
- You test with their EHR configuration
- Hospital provides test patient data (still synthetic)
- Typical duration: 2-4 weeks

### Phase 3: Security & Compliance Review
- Hospital conducts security audit:
  - Code review
  - HIPAA compliance verification
  - Audit logging review
  - Data encryption validation
- You may need to complete:
  - **Security questionnaire** (typically 50+ questions)
  - **HIPAA Business Associate Agreement (BAA)**
  - **Compliance certification** (SOC 2 or similar)

### Phase 4: Production Deployment
- Hospital approves and deploys to production EHR
- Real patient data flows through your app
- **You must have:**
  - Audit logging enabled
  - Error monitoring in place
  - 24/7 support contact information
  - Incident response plan

---

## 7. Costs, Certifications, Compliance

### Costs

| Item | Cost | Notes |
|------|------|-------|
| App Orchard Account | **FREE** | Developer access, sandboxes |
| Private Sandboxes | **FREE** | Up to 2-3 per account |
| Hospital Integration | **Varies** | $5,000 - $50,000+ depending on hospital and complexity |
| Certification | **Varies** | Optional; hospitals often don't require it |

**Real-world example:**
- Startup with 1 hospital: ~$10,000 integration fee
- Large enterprise: $50,000+ for multi-hospital deployment

### Required Certifications

**Minimum Required:**
- ✅ **HIPAA Compliance** (self-certified via BAA)
- ✅ **SMART on FHIR Certified** (Free; test in sandbox)

**Optional but Recommended:**
- 📋 **ONC Health IT Certification** (if you're selling the app)
- 📋 **SOC 2 Type II** ($3,000 - $10,000; shows security maturity)

### Compliance Checklist

```
☐ HIPAA Business Associate Agreement (hospital provides template)
☐ Audit logging for all user actions and data access
☐ Encryption in transit (HTTPS/TLS 1.2+)
☐ Encryption at rest for stored patient data
☐ User authentication with password requirements
☐ Session timeout after inactivity
☐ PHI de-identification before AI processing (critical!)
☐ Incident response plan documented
☐ Terms of Service mentioning data handling
☐ Privacy Policy
☐ Documentation of security controls
```

---

## 8. Common Gotchas & Pitfalls

### 🚨 Critical Gotchas

**1. Redirect URI Mismatch**
- **Problem:** Localhost redirect works in sandbox, but production hospitals use HTTPS
- **Fix:** Register both `http://localhost:8080/redirect` (dev) and `https://yourdomain.com/redirect` (prod)

**2. FHIR Scopes Too Broad**
- **Problem:** Requesting `patient/*.write` when you only need read access
- **Fix:** Request minimal scopes; hospitals audit this

**3. PHI Sent to Public AI APIs**
- **Problem:** Sending raw patient data to OpenAI/OpenRouter
- **Fix:** De-identify data BEFORE sending to AI (remove MRN, DOB, names)

**4. No Audit Logging**
- **Problem:** Hospital compliance officer requires proof of who accessed what patient data
- **Fix:** Log every FHIR API call with timestamp, user, patient, action

**5. Token Expiration Not Handled**
- **Problem:** Access token expires mid-session
- **Fix:** Implement refresh token rotation; handle 401 responses gracefully

### 🔧 Implementation Gotchas

**6. Sandbox ≠ Production**
- Sandbox uses slightly different formats/endpoints
- Some FHIR resources have optional fields that vary
- **Fix:** Test with production hospital sandbox before going live

**7. Missing Encounter Context**
- **Problem:** Sometimes `client.encounter.id` is null (patient portal vs clinician context)
- **Fix:** Handle both scenarios; you might only have patientId

**8. FHIR Search Pagination**
- **Problem:** Large result sets don't return all at once
- **Fix:** Use `_count` parameter and handle `next` links in bundles

**9. Synthetic Data ≠ Real Data**
- Sandbox patients lack edge cases (complex histories, migrations, etc.)
- **Fix:** Work closely with hospital during real testing phase

**10. Hospital Firewall Issues**
- Your backend might be blocked from hospital FHIR endpoints
- **Fix:** Coordinate with hospital IT for IP whitelisting

---

## 9. Quick Reference: URLs & Links

| Resource | URL |
|----------|-----|
| App Orchard Sign Up | https://apporchard.epic.com/ |
| App Orchard Dashboard | https://apporchard.epic.com/dashboard |
| FHIR Documentation | https://fhir.epic.com/ |
| SMART on FHIR Specs | http://hl7.org/fhir/smart-app-launch/ |
| Your Sandbox FHIR | `https://sandbox-[ID].epic.com/api/FHIR/R4/` |
| Epic Developer Community | https://open.epic.com/ (public sandbox for learning) |
| fhirclient.js Docs | https://github.com/smart-on-fhir/client-js |

---

## 10. Next Steps for DocAssistAI

### Immediate (This Week)
- [ ] Create Epic App Orchard account
- [ ] Create private sandbox
- [ ] Register DocAssistAI as SMART app
- [ ] Update your `.env` files with sandbox details

### Short-term (Next 2 weeks)
- [ ] Test SMART launch flow locally
- [ ] Fetch and display patient data in your app
- [ ] Implement de-identification for AI calls
- [ ] Build comprehensive audit logging

### Medium-term (Next month)
- [ ] Connect to hospital sandbox
- [ ] Hospital security review
- [ ] Complete compliance checklist

### Long-term (Production)
- [ ] Hospital deployment
- [ ] Production monitoring setup
- [ ] Support plan

---

**Status:** ✅ Comprehensive Epic guide complete. See Cerner/Oracle guide next.
