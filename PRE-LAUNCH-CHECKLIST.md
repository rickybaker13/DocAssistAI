# DocAssist Scribe — Pre-Launch Checklist

> Last updated: 2026-03-07
> Target: Real-world clinical testing in ~1 week, public launch ~3-4 weeks

---

## Current Status

The core product is **functionally complete and deployed**:
- Frontend: Vercel (`www.docassistai.app`) — auto-deploys on git push
- Backend: DigitalOcean Droplet (`api.docassistai.app`) — Docker Compose stack
- Audio → Structured Note pipeline: **~15 seconds** (Groq Whisper + Claude Haiku 4.5)
- Auth: JWT cookies, 7-day expiry
- Billing: Square embedded card + hosted checkout, 7-day free trial, auto-renewal
- PII Scrubbing: Presidio Analyzer + Anonymizer (Docker, internal network)
- TLS: Caddy auto-provisioned (cert valid through May 2026)

---

## Phase 1: Legal & Compliance (BEFORE testers)

### 1.1 Publish Terms of Service
- [ ] Draft TOS document covering:
  - Subscription terms ($20/month, 7-day free trial, auto-renewal, cancellation policy)
  - AI-generated content disclaimer (notes are drafts, clinician is responsible for review)
  - HIPAA scope: DocAssistAI as a Business Associate; user responsibilities as Covered Entity
  - Data handling: PII scrubbing, no PHI stored in frontend, audit logging
  - Acceptable use policy (licensed healthcare professionals only)
  - Limitation of liability (AI output is not medical advice)
  - Intellectual property (user owns their notes; DocAssistAI owns the platform)
  - Account termination and data deletion policy
- [ ] Have attorney review for HIPAA/healthcare compliance
- [ ] Host at `www.docassistai.app/terms` (add route + page component)
- [ ] Add link to TOS in app footer and registration page

### 1.2 Publish Privacy Policy
- [ ] Draft Privacy Policy document covering:
  - What data is collected (email, name, specialty, audio recordings, clinical notes)
  - How audio is processed (Groq Whisper transcription → PII scrubbing → AI → deleted)
  - Third-party processors: Anthropic (BAA required), Groq (BAA required), Square (PCI DSS), Resend (transactional email), DigitalOcean (BAA in place via Standard Support)
  - Data retention policy (notes stored in PostgreSQL, audio not retained after transcription)
  - User rights (access, correction, deletion of personal data)
  - HIPAA Notice of Privacy Practices (if applicable as BA)
  - Cookie policy (JWT auth cookie, no tracking cookies)
  - Contact information for privacy inquiries
- [ ] Have attorney review
- [ ] Host at `www.docassistai.app/privacy` (add route + page component)
- [ ] Add link to Privacy Policy in app footer and registration page

### 1.3 User Consent Flow
- [ ] **Registration page update**: Add TOS + Privacy Policy agreement checkbox
  - Current: Only `agreedToAutoRenewal` checkbox exists (in `ScribeRegisterPage.tsx`)
  - Add: "I have read and agree to the [Terms of Service](/terms) and [Privacy Policy](/privacy)"
  - Add: "I understand this application processes Protected Health Information (PHI) and I accept responsibility for ensuring my use complies with HIPAA and applicable regulations"
  - Both checkboxes required before account creation
- [ ] Store consent timestamp and version in `scribe_users` table
  - Add columns: `tos_accepted_at TIMESTAMPTZ`, `tos_version VARCHAR(20)`, `privacy_accepted_at TIMESTAMPTZ`, `privacy_version VARCHAR(20)`
- [ ] Backend: validate consent fields on `POST /api/scribe/auth/register`

### 1.4 BAA Coverage Verification
- [ ] Confirm DigitalOcean BAA is in place (Standard Support plan at $99/month — active)
- [ ] Verify Anthropic BAA status — check if Anthropic offers BAA for API customers
- [ ] Verify Groq BAA status — check if Groq offers BAA for API customers
- [ ] If Anthropic or Groq do not offer BAA: document that PII is scrubbed by Presidio before any data reaches these APIs (current architecture already does this)
- [ ] Square is PCI DSS compliant (no BAA needed for payment processing)
- [ ] Document BAA chain in a compliance summary

---

## Phase 2: Infrastructure & Operations (BEFORE testers)

### 2.1 Vercel Pro Plan
- [ ] Verify Vercel Pro plan is active (required for commercial use — Hobby plan is personal-only)
- [ ] If not active: upgrade at https://vercel.com/dashboard (cost: $20/month)

### 2.2 Prompt Caching (Cost Optimization)
- [ ] Research Anthropic prompt caching for system prompts
  - System prompts for note generation and focused analysis are repeated on every call
  - Anthropic prompt caching offers 90% savings on cached input tokens
  - Implementation: add `cache_control` to system message in `anthropic.ts` provider
- [ ] Estimate savings: with 300 encounters/user/month, system prompt tokens dominate input cost
- [ ] Implement if straightforward (likely a 5-line change in `anthropic.ts`)

### 2.3 Monitoring & Alerting
- [ ] Set up basic uptime monitoring for `api.docassistai.app/api/health`
  - Options: UptimeRobot (free tier), BetterStack, or DigitalOcean monitoring
- [ ] Configure email alerts for downtime
- [ ] Review backend error logging — ensure Winston audit logs capture failures

### 2.4 Database Backups
- [ ] Verify PostgreSQL backup strategy on DO droplet
  - Option A: `pg_dump` cron job to DigitalOcean Spaces (automated)
  - Option B: DigitalOcean managed backups (droplet snapshots)
- [ ] Test backup restore procedure at least once

---

## Phase 3: Clinical Testing (~2 weeks)

### 3.1 Recruit Testers
- [ ] Identify 3-5 clinicians for real-world testing (ICU, hospitalist, outpatient mix)
- [ ] Provide onboarding instructions (install PWA, create account, workflow walkthrough)
- [ ] Set up feedback channel (email, form, or Slack)

### 3.2 Testing Checklist
- [ ] Audio recording → transcription → note generation (various encounter lengths)
- [ ] Section editing and reordering
- [ ] Focused AI analysis with guideline citations
- [ ] Ghost-write chat insertion
- [ ] Note template selection and custom section building
- [ ] Copy-to-clipboard workflow (paste into EHR)
- [ ] Account management (billing, subscription, cancellation)
- [ ] PWA install on iPhone and Android
- [ ] Performance: confirm ~15s pipeline consistently
- [ ] PII scrubbing: verify names/dates/MRNs are redacted in AI requests

### 3.3 Bug Triage
- [ ] Track bugs found during testing
- [ ] Fix critical/blocking issues immediately
- [ ] Queue non-critical issues for post-launch

---

## Phase 4: Pre-Launch Polish

### 4.1 PWA Branding
- [ ] Rename PWA from "Scribe" to "DocAssist" or "DocAI" (see `TODO-NEXT-SESSION.md` item #2)
  - Update `manifest.webmanifest` (`name`, `short_name`)
  - Update `<title>` and `<meta>` tags in `index.html`

### 4.2 Payment Methods & Pricing
- [ ] Priority: ensure Credit Card (Square embedded) works end-to-end in production
- [ ] Stretch: wire up ACH, Apple Pay, Google Pay (see `TODO-NEXT-SESSION.md` item #1)
- [ ] Remove Bitcoin from payment options (Square doesn't support recurring Bitcoin)
- [ ] **Add $200/year annual subscription option**
  - Saves user $40/year vs. monthly ($240/year) — ~17% discount
  - Backend: add annual plan to Square subscription catalog
  - Frontend: add toggle on registration/account page (Monthly $20/mo | Annual $200/yr — save $40)
  - Update TOS to cover annual billing terms (prorated refund policy, renewal date)
  - Square processing cost drops from $0.96/mo to ~$0.88/mo effective (one $200 charge vs twelve $20 charges)

### 4.3 Landing Page
- [ ] Review and polish `www.docassistai.app` landing page
- [ ] Ensure pricing, feature list, and CTAs are current
- [ ] Add TOS and Privacy Policy links to footer

---

## Phase 5: Social Media & Marketing Campaign

### 5.1 Current Social Media Presence

The app already has social media accounts linked in the UI (`SocialMediaLinks.tsx`):

| Platform | Handle/URL | Status |
|----------|-----------|--------|
| LinkedIn | [/company/docassistai](https://www.linkedin.com/company/docassistai) | Created — needs content |
| X (Twitter) | [@docassistai](https://x.com/docassistai) | Created — needs content |
| Facebook | [/docassistai](https://www.facebook.com/docassistai) | Created — needs content |
| Instagram | [@docassistai](https://www.instagram.com/docassistai) | Created — needs content |
| YouTube | [@docassistai](https://www.youtube.com/@docassistai) | Created — needs content |
| TikTok | [@docassistai](https://www.tiktok.com/@docassistai) | Created — needs content |

Share links (LinkedIn, X, Facebook, Reddit, WhatsApp) are also wired into the registration and login pages.

### 5.2 Content Strategy

**Target audience**: ICU physicians, hospitalists, critical care specialists, independent clinicians, small-group practices

**Key messaging pillars**:
1. **Speed**: "Structured clinical note in 15 seconds" — demonstrate the audio-to-note pipeline
2. **Price**: "$20/month, no contract" — 3x cheaper than the nearest competitor (Commure at $60)
3. **ICU depth**: "The only ambient AI scribe built for the ICU" — vasopressor status, vent management, APACHE/SOFA
4. **Clinical intelligence**: "Evidence-backed section analysis with guideline citations" — Focused AI with Surviving Sepsis, ARDS Net, PADIS
5. **Zero friction**: "Any clinician, any device, 5 minutes to your first note" — no IT department, no EHR integration required

**Content types to create**:
- [ ] **Demo video** (30-60s): Record a real encounter → show note generated in 15s → show section editing → copy to clipboard
  - Short version for TikTok/Instagram Reels/YouTube Shorts
  - Long version for YouTube/LinkedIn
- [ ] **Before/after comparison**: Time spent on documentation before vs. after DocAssist Scribe
- [ ] **Feature spotlight posts** (carousel/thread format):
  - Drag-and-drop note builder
  - Focused AI with guideline citations
  - Ghost-write chat
  - PII scrubbing for HIPAA compliance
- [ ] **Pricing comparison infographic**: DocAssist vs. Commure vs. Nabla vs. DAX Copilot vs. Suki
- [ ] **Testimonials**: Collect from beta testers after Phase 3
- [ ] **Blog posts** (for LinkedIn articles + website):
  - "Why ICU documentation needs its own AI scribe"
  - "How we built a HIPAA-compliant AI scribe for $20/month"
  - "The hidden cost of ambient AI scribes: why $300/month products aren't worth it for solo clinicians"

### 5.3 Launch Campaign Plan

**Pre-launch (during testing phase)**:
- [ ] Post "coming soon" teaser content on LinkedIn and X
- [ ] Share behind-the-scenes development updates
- [ ] Engage in healthcare AI discussions on LinkedIn and medical subreddits (r/medicine, r/residency, r/criticalcare)

**Launch week**:
- [ ] Publish demo video across all platforms
- [ ] LinkedIn article: product announcement with positioning
- [ ] X thread: feature walkthrough with screenshots
- [ ] Reddit posts in relevant medical subreddits
- [ ] Email announcement to any existing waitlist or DocAssistAI user base

**Ongoing (post-launch)**:
- [ ] 2-3 posts/week across platforms
- [ ] Weekly feature tip or clinical documentation insight
- [ ] Engage with comments and DMs
- [ ] Track metrics: signups attributed to social, trial-to-paid conversion

### 5.4 Social Media Pipeline Automation
- [ ] Research/adapt the social media pipeline from skipurgatoryhouse.com for DocAssistAI
  - Content generation (AI-assisted post creation)
  - Scheduling pipeline for regular cadence
  - Platform-specific formatting (LinkedIn long-form, X threads, Instagram carousels)
- [ ] Set up scheduling tool (Buffer, Hootsuite, or custom pipeline)
- [ ] Create content calendar template

---

## Phase 6: Launch

### 6.1 Go-Live Checklist
- [ ] All Phase 1 items complete (legal docs published, consent flow live)
- [ ] All Phase 2 items complete (Vercel Pro, monitoring, backups)
- [ ] Phase 3 testing complete with no critical bugs
- [ ] Phase 4 polish items addressed
- [ ] Phase 5 launch content prepared
- [ ] Final smoke test: register → trial → record → note → copy → billing

### 6.2 Post-Launch Priorities
- [ ] Monitor error rates and pipeline latency
- [ ] Respond to user feedback within 24 hours
- [ ] Track key metrics: signups, trial-to-paid conversion, notes generated/day, churn
- [ ] Plan v2 features: SMART on FHIR EHR integration, native mobile app, additional specialty models
- [ ] **Multilingual support** (see Phase 7 below)

---

## Phase 7: Multilingual Support (Post-Launch)

Groq Whisper (`whisper-large-v3-turbo`) supports 99+ languages. Currently hardcoded to `language: 'en'` in `whisperService.ts`. Adding multilingual support would open the product to non-English-speaking clinicians — a segment underserved by most competitors (only Nabla at $119/mo has strong multilingual support).

### 7.1 Priority Languages
- [ ] Research which languages have the highest demand among target users (US-based clinicians documenting in non-English, plus international markets)
- [ ] Recommended starting set (top 5):
  1. **Spanish** — large US bilingual clinician population, Latin American market
  2. **French** — Canadian market (Quebec), West African healthcare systems
  3. **Portuguese** — Brazilian market (large physician workforce)
  4. **Arabic** — Middle East healthcare market, US immigrant physician population
  5. **Mandarin Chinese** — growing healthcare AI adoption in Asia-Pacific
- [ ] Validate Groq Whisper accuracy for each target language (test with sample recordings)

### 7.2 Implementation
- [ ] Add language selector to recording UI (dropdown or auto-detect)
  - Option A: User selects language before recording (simplest, most reliable)
  - Option B: Auto-detect via Whisper (omit `language` param — Whisper auto-detects, but slightly less accurate)
- [ ] Pass selected language to `whisperService.ts` → Groq API `language` param
- [ ] Claude note generation: system prompt already handles clinical terminology — test with non-English transcripts to verify note quality
- [ ] Consider: generate note in the same language as the transcript, or always in English? (likely configurable per user preference)
- [ ] UI: translate landing page and key UI strings for supported languages (stretch)

### 7.3 Marketing Angle
- [ ] "Multilingual AI scribe — document in Spanish, French, or Arabic" is a strong differentiator at $20/month
- [ ] Only Nabla ($119/mo) competes on multilingual — DocAssist at 6x lower price with comparable language support

---

## Unit Economics Reference

| Item | Monthly Cost |
|------|-------------|
| DigitalOcean Droplet (4GB) | $24 |
| DigitalOcean Standard Support (BAA) | $99 |
| Vercel Pro | $20 |
| Domain (docassistai.app) | ~$1.25 |
| **Fixed costs** | **~$144/month** |

| Item | Per-User Cost (300 encounters/month) |
|------|--------------------------------------|
| Groq Whisper (transcription) | ~$1.00 |
| Anthropic Haiku 4.5 (note gen) | ~$1.35 |
| Anthropic Sonnet 4.6 (focused AI, chat) | ~$1.88 |
| Square processing (3.3% + $0.30) | ~$0.96 |
| **Variable cost per user** | **~$5.19/month** |

**At $20/month**: ~$14.81 margin per user (74%), break-even at ~10 paying users
**At $200/year** (~$16.67/month effective): ~$11.48 margin/mo per user (69%), but higher LTV due to annual commitment and lower churn

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/components/scribe-standalone/ScribeRegisterPage.tsx` | Registration page — add TOS/Privacy consent |
| `src/components/scribe-standalone/SocialMediaLinks.tsx` | Social media follow/share links |
| `backend/src/routes/scribeAuth.ts` | Auth endpoints — add consent validation |
| `backend/src/database/migrations.ts` | DB migrations — add consent columns |
| `infra/docker-compose.prod.yml` | Production Docker stack |
| `docs/plans/2026-02-23-competitor-analysis.md` | Full competitor analysis |
| `docs/plans/2026-02-23-scribe-standalone-design.md` | Product design document |
| `ARCHITECTURE.md` | System architecture (updated 2026-03-07) |
| `IT-INFRASTRUCTURE.md` | Infrastructure details (updated 2026-03-07) |
