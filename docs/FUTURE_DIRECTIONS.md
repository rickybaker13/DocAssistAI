# DocAssistAI — Future Directions & Roadmap

> Living document. Add features as they're identified. Move to `docs/plans/` when ready for design.

---

## CodeAssist (Billing Coder Module) — Future Enhancements

### HCC / RAF Scoring
Hierarchical Condition Category scoring for risk adjustment. Calculate RAF scores from extracted ICD-10 codes to help practices understand revenue impact. Requires CMS HCC model coefficients and crosswalk tables.

### Modifier Suggestions
CPT modifier recommendations (-25, -59, -76, -XE, etc.) based on code combinations and clinical context. Requires understanding of NCCI edits and payer-specific modifier rules.

### Auto-Submission to Payers / Clearinghouse Integration
Direct electronic claim submission (837P format) to clearinghouses like Availity, Change Healthcare, or Trizetto. Eliminates the manual spreadsheet-to-UPA handoff. Requires EDI 837 formatting, enrollment with clearinghouses, and payer enrollment verification.

### Manual Code Editing & Custom Codes
Allow coders to manually add, remove, or modify AI-suggested codes before saving. V1 is read-only suggestions + copy; this adds an editable code grid with autocomplete from ICD-10-CM and CPT code databases.

### Cross-Encounter Code History & Trending
Dashboard showing coding patterns over time: most common diagnoses per provider, E/M level distribution, denial rate correlation (if payer feedback integrated). Useful for coding audits and provider education.

### Real-Time Coding As-You-Type
Stream coding suggestions as the coder pastes and the note text grows, rather than waiting for a "Generate" button press. Requires streaming AI responses and incremental code extraction.

### Coder Chat / Follow-Up Questions
After initial code extraction, allow the coder to ask follow-up questions about the note: "Is there enough documentation to support sepsis?", "What would I need to code this as a higher E/M?" Uses the existing chat infrastructure with coding-specific system prompt.

### EHR Integration (HL7 FHIR / Direct Import)
Instead of copy-paste, pull notes directly from the EHR via FHIR API or HL7 ADT feeds. Requires per-EHR integration work (Epic, Cerner, Meditech, etc.) and likely BAAs with each vendor.

### Batch Bulk Upload
Upload a file (CSV, PDF, or multi-note text file) containing multiple encounter notes at once. System parses, separates, and processes all notes in parallel. Useful for end-of-week catch-up when a coder has many notes queued.

### Coding Quality Feedback Loop
When a coder flags a code as "disagree", capture the correction and feed it back into prompt tuning. Over time, the AI learns practice-specific coding preferences and payer requirements.

### Provider-Facing Coding Report
A read-only view for clinicians showing how their notes were coded, which documentation gaps were flagged, and E/M level trends. Helps providers improve documentation quality at the source.

---

## Scribe Module — Future Enhancements

### Streaming AI Responses
Switch from batch `InvokeModelCommand` to streaming responses so users see note text appear progressively during generation. Better UX on long notes.

### RAG / Patient Data Indexing
Activate the existing `backend/src/services/rag/` embedding service and vector store. Index patient data for context-aware responses across encounters.

### Multi-Language Transcription
Support non-English encounter transcription via Whisper's multilingual models. Detect language automatically or let the user select.

---

## Platform — Future Enhancements

### Email Service (SES)
Email verification on signup, password reset, invite links. See `docs/NEXT_STEPS.md` for implementation details.

### DigitalOcean Managed PostgreSQL
Migrate from containerized PostgreSQL to DO Managed Database for automated backups, failover, and patch management.

### Mobile App
React Native or PWA for on-the-go note review and coding. Scribe recording already works on mobile browsers; native app adds push notifications and offline draft support.
