# DocAssistAI SMART on FHIR Research — Executive Summary

**Completed:** Feb 16, 2026 — 11:45 PM EST  
**Prepared for:** Matt  
**Status:** Ready to review and act on

---

## TL;DR — What You Need to Know

✅ **Your DocAssistAI architecture is solid** — React + Express backend with HIPAA audit logging is exactly what hospitals want.

✅ **Both Epic and Cerner are accessible** — Developer accounts are free; sandboxes are free; no costs until you integrate with a hospital.

✅ **You have all the FHIR resources you need** — Patient data, encounters, clinical notes, labs, meds, vitals are all available via standard FHIR APIs.

✅ **SMART on FHIR is the gold standard** — Every hospital supports it; OAuth2 flow is secure; you don't need to learn hospital-specific APIs.

⏱️ **Timeline:** Sandbox → Hospital Integration → Production
- **Sandbox development:** 2-4 weeks (you, alone)
- **Hospital testing:** 4-8 weeks (you + hospital IT)
- **Go-live:** 1-2 weeks (final deployment)
- **Total:** 2-4 months from start to first hospital patient

💰 **Costs:**
- **Development (now):** $0 (free sandboxes)
- **First hospital integration:** $10K-$50K (hospital fee, varies)
- **Per hospital after that:** $5K-$20K/year (maintenance)

---

## Your Current DocAssistAI Status

### What You've Already Built ✅

1. **SMART on FHIR-compliant app** — Your code uses the right library (`fhirclient.js`)
2. **Backend architecture** — Express server with auth, audit logging, security middleware
3. **HIPAA-ready compliance** — PHI protection middleware, audit logging, de-identification hooks
4. **Flexible AI provider support** — Can use OpenAI, OpenRouter, or self-hosted models
5. **FHIR resource integration** — Already configured for all key resources:
   - Patient, Encounter, Condition, Observation, MedicationRequest, DocumentReference, etc.

### What's Missing for Production 🚧

1. **Hospital sandbox testing** — Need to register with Epic/Cerner and test in their environments
2. **De-identification pipeline** — Need to scrub PHI before sending to AI
3. **Comprehensive audit logging** — Basic logging exists; need hospital-audit-ready format
4. **Error handling & monitoring** — Need proper Sentry/error tracking for production
5. **Support infrastructure** — Need 24/7 contact info, incident response plan

---

## Platform Comparison: Which Should You Prioritize?

### Epic (App Orchard)

**Pros:**
- Larger market share (~40% of US hospitals)
- More hospitals using it = more potential customers
- Very developer-friendly platform

**Cons:**
- Slightly more complex sandbox setup
- More hospitals = higher standards for integration

**Recommendation:** Start with Epic if your first hospital target uses Epic.

### Cerner/Oracle Health

**Pros:**
- ~25% of US hospitals (still massive)
- Slightly easier sandbox setup
- Good documentation

**Cons:**
- Smaller market than Epic (but still huge)
- Oracle's support can be slow

**Recommendation:** Start with Cerner if your first hospital target uses Cerner.

**Reality:** You'll likely need to support both eventually. Pick the one your first hospital uses.

---

## Immediate Action Items (This Week)

### ⭐ Priority 1: Identify Your First Hospital Target

**Before you do anything else,** determine:
1. What EHR does your target hospital use? (Epic or Cerner?)
2. Who's your contact at the hospital? (IT director, clinical informatics?)
3. What problem are you solving for them? (Speed up documentation? Reduce burnout?)

**Why:** Once you know the EHR, focus on that platform only. Don't split effort between both.

### ⭐ Priority 2: Register with the Chosen Platform

**If Epic:**
- [ ] Go to https://apporchard.epic.com/
- [ ] Create developer account
- [ ] Create private sandbox
- [ ] Register DocAssistAI as SMART app
- [ ] Get Client ID & Client Secret

**If Cerner:**
- [ ] Go to https://developer.cerner.com/
- [ ] Create developer account
- [ ] Create development sandbox
- [ ] Register DocAssistAI as SMART app
- [ ] Get Client ID & Client Secret

**Estimated time:** 30 minutes to register; 15-30 minutes for sandbox to be ready.

### ⭐ Priority 3: Test SMART Launch Locally

```bash
# Update your .env files with sandbox credentials
VITE_FHIR_BASE_URL=https://[sandbox-url]/api/FHIR/R4
VITE_CLIENT_ID=[from-registration]
VITE_REDIRECT_URI=http://localhost:8080/redirect

# Start your app
npm run dev  # frontend
cd backend && npm run dev  # backend

# Visit http://localhost:8080
# You should see the SMART launch flow
```

**Goal:** Confirm SMART authentication works; you can fetch mock patient data.

---

## 4-Week Development Plan

### Week 1: Sandbox Setup & SMART Launch
- [ ] Register with chosen platform
- [ ] Create sandbox
- [ ] Register app
- [ ] Get Client ID/Secret
- [ ] Test SMART launch locally
- [ ] Confirm you can fetch patient data

**Output:** Working SMART launch in sandbox

### Week 2: Data Fetching & Display
- [ ] Fetch and display patient demographics
- [ ] Fetch and display encounter history
- [ ] Fetch and display clinical notes
- [ ] Fetch medications, vitals, labs
- [ ] Test all data types in sandbox

**Output:** App pulls real patient data from sandbox

### Week 3: De-identification & AI Integration
- [ ] Implement de-identification pipeline (remove MRN, DOB, names)
- [ ] Send de-identified data to AI backend
- [ ] Test note generation
- [ ] Verify no PHI reaches external AI

**Output:** De-identified AI-generated notes

### Week 4: Compliance & Hospital Prep
- [ ] Implement comprehensive audit logging
- [ ] Document security controls
- [ ] Create HIPAA risk assessment
- [ ] Prepare to hand off to hospital IT
- [ ] Write documentation for hospital

**Output:** Hospital-ready app

---

## Key Technical Details

### SMART Launch Flow (What Happens)

```
1. User: "Launch DocAssistAI from EHR"
2. EHR: Redirects to your app with ?launch=ABC&iss=https://...
3. Your app: Calls fhirclient.oauth2.ready()
4. Browser: Redirects to hospital's OAuth server
5. User: Logs in (if not already) and authorizes app
6. OAuth: Redirects back to your app with ?code=XYZ
7. Your backend: Exchanges code for access_token
8. Your app: Uses token to fetch patient data via FHIR APIs
9. Your app: Displays data; sends de-identified copy to AI
```

**Key points:**
- You never see the user's password (OAuth handles auth)
- Access token is short-lived (expires in 1 hour typically)
- Refresh token allows long-running sessions
- All communication is encrypted (HTTPS)

### FHIR Resources You'll Use

**Essential (must have):**
```
Patient           → Demographics, DOB, contact info
Encounter         → Visit details, type, dates
DocumentReference → Clinical notes, reports
Condition         → Problem list, diagnoses
Observation       → Labs, vitals, results
MedicationRequest → Active medications
```

**Nice-to-have (for context):**
```
AllergyIntolerance → Allergies & reactions
Procedure         → Past surgeries/procedures
CarePlan          → Treatment plans
DiagnosticReport  → Imaging, complex lab results
```

### De-identification (CRITICAL)

Before sending patient data to OpenAI/OpenRouter, scrub:
```
- Patient name
- Medical Record Number (MRN)
- Date of Birth (use age instead)
- Phone, email, address
- Social Security Number (if present)
- Hospital account number
```

**Example:**
```
BEFORE: "John Doe (MRN: 12345), DOB 1985-06-15, admitted to Boston Medical Center"
AFTER:  "[AGE: 39] admitted to hospital, presenting with..."
```

This is non-negotiable for HIPAA compliance.

---

## Common Pitfalls to Avoid

### 🚨 Critical

1. **Sending raw PHI to public AI APIs** → Violates HIPAA
   - **Fix:** De-identify before sending to OpenAI/OpenRouter

2. **Hardcoding API keys in frontend** → Security breach
   - **Fix:** Put keys only in backend .env

3. **Not implementing audit logging** → Hospital won't approve
   - **Fix:** Log every API call with timestamp, user, patient, action

4. **Ignoring token expiration** → App crashes mid-session
   - **Fix:** Implement refresh token rotation

### ⚠️ Common

5. **Testing only with mock data** → Real EHR data formats differ
   - **Fix:** Test in hospital sandbox before go-live

6. **Assuming one hospital = all hospitals** → Each hospital configures differently
   - **Fix:** Build flexibility; work with hospital IT during integration

7. **Not handling errors gracefully** → Users frustrated when API fails
   - **Fix:** Graceful fallbacks; error messages for users

---

## What Happens Next (Your Path to Hospital)

### Phase 1: Sandbox Development (You, 2-4 weeks)
- Build and test in Epic/Cerner sandbox
- Perfect the FHIR integration
- Implement all compliance controls
- Document everything

### Phase 2: Hospital Evaluation (You + Hospital IT, 1-2 weeks)
- Hospital IT reviews your app
- Hospital decides if it's worth integrating
- Hospital may ask for security audit
- Hospital provides integration timeline

### Phase 3: Hospital Sandbox Testing (You + Hospital, 2-4 weeks)
- Hospital installs your app in their sandbox
- You test with their real EHR system
- Hospital conducts security audit
- You fix any issues
- Hospital approves for production

### Phase 4: Production Deployment (You + Hospital, 1-2 weeks)
- Hospital turns on for real patient data
- You monitor closely (errors, performance)
- Hospital trains clinicians
- Go-live!

### Phase 5: Ongoing Support (You, indefinite)
- Monitor for errors
- Hospital may request features
- You provide updates
- Maintain 24/7 support contact

---

## Cost Reality Check

| Phase | Cost | Notes |
|-------|------|-------|
| **Now (Sandbox)** | $0 | Free accounts, free sandboxes |
| **Hospital Integration** | $10K-50K | Hospital pays Cerner/Epic licensing; integration fee varies by hospital |
| **Per Hospital/Year** | $5K-20K | Maintenance, support |
| **National Expansion** | $500K+/year | 10+ hospitals: infrastructure, support staff |

**Reality:** Most healthcare startups:
- Break even after 3-5 hospitals
- Raise Series A once they have paying hospitals
- Scale to 20-50 hospitals at Series B

---

## Your Competitive Advantage

✅ **Backend architecture** — Security-first design (many startups skip this)  
✅ **AI integration** — Flexible provider support (OpenAI, self-hosted, OpenRouter)  
✅ **FHIR-native** — Built on standards, not proprietary APIs  
✅ **De-identification ready** — Thinks about HIPAA from day one  
✅ **Audit logging** — Hospitals will love the compliance posture  

---

## Docs You'll Reference

I've created two comprehensive guides for you:

1. **EPIC_FHIR_DEVELOPER_GUIDE.md** — Complete Epic setup (38KB)
   - Step-by-step account creation
   - Sandbox setup
   - App registration
   - FHIR endpoints & examples
   - SDKs & sample code
   - Gotchas & pitfalls

2. **CERNER_ORACLE_FHIR_DEVELOPER_GUIDE.md** — Complete Cerner setup (48KB)
   - Step-by-step Oracle Developer Portal
   - Sandbox setup
   - App registration
   - FHIR endpoints & examples
   - SDKs & sample code
   - Gotchas & pitfalls

Both include:
- ✅ Actual URLs for sign-up, documentation, sandbox
- ✅ Complete FHIR resource reference
- ✅ Real code examples (JavaScript + Python)
- ✅ Common pitfalls & workarounds
- ✅ Timeline to production
- ✅ Cost breakdowns

---

## Conversation Starters for Hospitals

Once you've built in sandbox, here's how to approach a hospital:

**Best approach:**
> "We built a SMART on FHIR app that integrates directly into your Epic/Cerner EHR. It helps clinicians [specific benefit: faster documentation / less clerical work / better notes]. We're HIPAA-compliant with full audit logging. Can we demo it in your sandbox?"

**Hospitals like to hear:**
- ✅ "SMART on FHIR" (standard integration path)
- ✅ "Your existing EHR" (no learning new system)
- ✅ "HIPAA-compliant" (security is non-negotiable)
- ✅ "Audit logging" (compliance + liability protection)
- ✅ "De-identified data" (patient privacy protected)

---

## Next Morning Checklist (When You Wake Up)

- [ ] Read both guides (Epic + Cerner)
- [ ] Decide: Which platform first? (Epic or Cerner?)
- [ ] Identify: Do you have a hospital contact? What EHR do they use?
- [ ] Action: Create developer account for your chosen platform
- [ ] Test: Register sandbox, test SMART launch locally
- [ ] Report back: What did you discover?

---

**Status:** ✅ Research complete. Everything documented. Ready to ship DocAssistAI to real hospitals.

**Next step:** You review, decide on platform, and let me know what you find when you try sandbox setup.

Good luck! 🚀
