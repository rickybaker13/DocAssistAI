# DocAssistAI Privacy Policy

**Effective date:** 2026-04-03  
**Entity:** DocAssistAI ("DocAssistAI," "we," "us," "our")

> **Important:** This policy is a template for legal/compliance review and publication hardening. It is not legal advice.

## 1. Scope

This Privacy Policy explains how DocAssistAI collects, uses, discloses, and protects personal information when you use our websites, applications, APIs, and related services (the "Services").

If you are an end user accessing Services through a healthcare organization, that organization may control certain data-processing decisions. In those cases, we may act as a service provider/processor on its behalf.

## 2. HIPAA and Clinical Data Context

Depending on service configuration and contracting:

- DocAssistAI may process Protected Health Information (PHI) as a Business Associate under a signed Business Associate Agreement (BAA).
- Where a BAA applies, PHI processing follows HIPAA/HITECH and the BAA terms.
- If no BAA is in place, Customers must not submit PHI unless legally permitted and contractually authorized.

## 3. Information We Collect

### 3.1 Account and Identity Data

- Name, organization, work email, username, role
- Authentication metadata (login timestamps, IP-derived context, device/session identifiers)

### 3.2 Customer-Submitted Content

- Clinical notes, transcripts, prompts, templates, and related healthcare workflow content
- Files, structured records, and integration payloads (e.g., EHR/FHIR-connected datasets where enabled)
- Clinical notes pasted into the CodeAssist billing coder module for code extraction
- Patient demographic information entered by billing coders (name, MRN, date of service, provider name)

### 3.3 Technical and Usage Data

- Log files, diagnostics, feature usage metrics, API metadata, error reports
- Browser/device information and performance telemetry

### 3.4 Communications Data

- Support requests, account communications, security notices, and operational messages

## 4. How We Use Information

We use information to:

1. Provide and operate the Services,
2. Authenticate users and secure accounts,
3. Generate requested AI-assisted outputs,
4. Monitor performance, reliability, and abuse,
5. Troubleshoot and provide support,
6. Comply with legal, security, and contractual obligations,
7. Improve Service quality and features, including through de-identified/aggregated analytics where permitted.

We do **not** sell PHI.

## 5. Legal Bases (Where Applicable)

Depending on jurisdiction and context, legal bases may include:

- performance of a contract,
- legitimate interests (e.g., security and product improvement),
- compliance with legal obligations,
- consent where required.

## 6. Disclosures of Information

We may disclose information:

- to subprocessors/service providers (hosting, security, analytics, support, communications),
- to integration partners at your direction,
- to affiliates involved in service delivery,
- to regulators/law enforcement where legally required,
- in connection with mergers, financing, acquisition, or asset transfers,
- to protect rights, safety, security, and fraud-prevention interests.

All disclosures are subject to contractual and legal controls appropriate to data sensitivity.

## 7. Subprocessors and Vendor Management

DocAssistAI uses third-party providers for infrastructure and functionality (which may include AI model providers). We apply a vendor review process that may include security and contractual due diligence.

On request (and where contractually required), we provide available subprocessor information relevant to the Services in use.

## 8. Data Retention

We retain personal information only as long as necessary for service delivery, contractual commitments, legal and regulatory obligations, dispute resolution, and security purposes.

### Retention Periods by Data Type

| Data Type | Retention Period | Notes |
|---|---|---|
| **Clinical notes** | 3 days from last edit | DocAssistAI is a drafting tool, not a system of record. Notes should be copied to your EHR before the retention window expires. |
| **Account data (active subscription)** | Duration of subscription | Retained while subscription is active. |
| **Account data (expired trial)** | 30 days after trial ends | Account and all associated data purged automatically. |
| **Account data (cancelled subscription)** | 90 days after billing period ends | Grace period for resubscription without data loss. |
| **Password reset tokens** | 24 hours after expiry | Automatically swept. |
| **Audit logs** | 1 year | Rotated via file-size limits (100 MB total). |
| **Audio recordings** | Not retained | Audio is processed in-memory for transcription and immediately discarded. Never stored to disk. |
| **Pasted clinical notes (CodeAssist)** | Not retained | Notes pasted into the billing coder module are processed in-memory for code extraction and immediately discarded. Raw note text is never written to disk or database. |
| **Extracted billing codes (CodeAssist)** | Duration of team subscription | ICD-10/CPT codes and brief supporting excerpts are retained for audit and export purposes. |
| **Patient demographics (CodeAssist)** | Duration of team subscription | Patient name, MRN, provider name, and facility are encrypted at rest (AES-256-GCM) and retained for spreadsheet export. |

Automated cleanup runs daily. Users may request earlier deletion by contacting admin@docassistai.app.

## 9. Security Measures

We implement safeguards designed to protect personal information, including:

- **Encryption in transit** — TLS/HTTPS on all external connections (auto-provisioned via Let's Encrypt).
- **PII de-identification** — All clinical text is scrubbed of protected health information (PHI) using Microsoft Presidio before reaching any external AI provider. The system fails closed: if de-identification is unavailable, AI requests are blocked (HTTP 503).
- **Access and authentication controls** — bcrypt-hashed passwords (cost 12), HTTP-only secure cookies, cross-site request protections.
- **Automatic session timeout** — Sessions expire after 15 minutes of inactivity, with a 60-second warning (per HIPAA 45 CFR 164.312(a)(2)(iii)).
- **Token revocation** — All active sessions are immediately invalidated when a password is changed.
- **Audit logging** — Access to clinical data and AI service usage is logged with metadata only (no PHI in logs).
- **Rate limiting** — Global and per-endpoint rate limiting to prevent abuse.
- **Infrastructure isolation** — All backend services (database, PII scrubbing, transcription) communicate over an internal network; only the TLS reverse proxy is externally accessible.
- **Column-level encryption** — Sensitive patient demographic fields (name, MRN, provider name) stored by the CodeAssist billing coder module are encrypted at rest using AES-256-GCM with unique initialization vectors per value.
- **Transient processing** — Clinical notes pasted into CodeAssist are held in server memory only for the duration of the code extraction request. Raw note text is never persisted to disk or database.
- **Role-based access control** — User roles (clinician, coding manager, billing coder) restrict access to features and data. Billing coders can only access their own coding sessions; managers can view team-wide data.
- **Automated data retention** — Clinical notes, expired accounts, and stale credentials are automatically purged per the retention schedule in Section 8.

No system is completely secure; however, we continuously assess and improve controls.

## 10. International Data Transfers

If data is transferred across borders, we implement appropriate transfer safeguards required by applicable law and contract.

## 11. Your Rights and Choices

Depending on jurisdiction, you may have rights to:

- access personal information,
- correct inaccurate data,
- request deletion,
- object to or restrict certain processing,
- data portability,
- withdraw consent (where processing is consent-based).

For data controlled by a healthcare organization using DocAssistAI, we may direct your request to that organization when required.

## 12. Cookies and Similar Technologies

Our web properties may use cookies or similar technologies for:

- essential functionality,
- performance and analytics,
- security and session management.

Where required, we provide consent controls.

## 13. Children’s Privacy

The Services are not intended for use by children under 13 as standalone users. We do not knowingly collect personal information directly from children in violation of law.

## 14. Changes to This Policy

We may update this Privacy Policy periodically. We will post the revised version with a new effective date and provide additional notice where required.

## 15. Contact Us

For privacy questions or rights requests:

- Email: admin@docassistai.app
- Address: [Insert legal entity address]

For HIPAA/privacy incidents, follow your contractual incident reporting path in addition to this contact.

---

## Appendix A — Internal Publication Checklist

Before external publication, confirm:

1. Legal entity name and address.
2. Final subprocessor disclosure mechanism.
3. Cookie consent tooling language.
4. Jurisdiction-specific addenda (e.g., U.S. state privacy laws, GDPR/UK GDPR if applicable).
5. Alignment with BAA/DPA commitments and security documentation.
