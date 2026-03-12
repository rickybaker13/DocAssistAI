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
- [x] Draft TOS document (covers subscription, AI disclaimer, HIPAA scope, data handling, acceptable use, liability, IP, termination)
- [ ] Have attorney review for HIPAA/healthcare compliance
- [x] Host at `www.docassistai.app/terms` (ScribeTermsPage.tsx)
- [x] Add link to TOS in app footer and registration page
- [x] Contact email updated to `admin@docassistai.app`

### 1.2 Publish Privacy Policy
- [x] Draft Privacy Policy document (covers data collection, audio processing, third-party processors, retention, user rights, HIPAA, cookies, contact)
- [ ] Have attorney review
- [x] Host at `www.docassistai.app/privacy` (ScribePrivacyPage.tsx)
- [x] Add link to Privacy Policy in app footer and registration page
- [x] Contact email updated to `admin@docassistai.app`

### 1.3 User Consent Flow
- [x] Consent attestation modal after account creation (ConsentAttestationModal.tsx)
  - Non-dismissable popup with checkbox: "I have read and agree to the Terms of Service and the Privacy Policy"
  - Gated via ScribeAuthGuard — blocks all authenticated routes until accepted
  - TOS versioning: bumping `CURRENT_TOS_VERSION` re-triggers for all users
- [x] Store consent timestamp and version in `scribe_users` table
  - Columns added: `tos_accepted_at TIMESTAMPTZ`, `privacy_accepted_at TIMESTAMPTZ`, `tos_version TEXT`
- [x] Backend endpoints: `GET /consent-status`, `POST /accept-terms`

### 1.4 BAA Coverage Verification
- [ ] Confirm DigitalOcean BAA is in place (Standard Support plan at $99/month — pending, submitted)
- [x] **Groq BAA: COVERED** — Groq includes a Business Associate Addendum (BAA) in their Terms of Service (effective October 15, 2025). No separate signing required. By using Groq services, the BAA is automatically in effect.
  - BAA document: https://console.groq.com/docs/legal/customer-business-associate-addendum
  - This covers PHI in audio sent to Groq Whisper API for transcription
- [x] **Anthropic: No BAA needed** — All PII/PHI is scrubbed by Presidio (self-hosted) before any text reaches Anthropic's API. No protected health information is transmitted to Anthropic.
- [x] **Square: No BAA needed** — PCI DSS compliant for payment processing. No PHI involved in payment flow.
- [ ] Document full BAA/compliance chain in a compliance summary document

---

## Phase 2: Infrastructure & Operations (BEFORE testers)

### 2.1 Vercel Pro Plan
- [x] Vercel Pro plan upgraded (2026-03-08) — $20/month, required for commercial use

### 2.2 Prompt Caching (Cost Optimization)
- [x] Implemented Anthropic prompt caching in `anthropic.ts` provider
  - System prompts sent with `cache_control: { type: 'ephemeral' }` for 90% savings on cached input tokens
  - Cache performance logged: `[Anthropic] Cache: X read, Y created, Z input`
  - All 4 system prompts (generate, focused analysis, ghost-write, chat) benefit automatically
  - Estimated savings: ~$0.50-1.00/user/month on system prompt tokens at 300 encounters/month

### 2.3 Monitoring & Alerting
- [x] UptimeRobot (free tier) configured (2026-03-08) — SSO via Google account
  - Monitors: `https://api.docassistai.app/health`, `https://api.docassistai.app/api/health`, `https://www.docassistai.app`
  - 5-minute check intervals, email alerts on downtime
- [ ] Review backend error logging — ensure Winston audit logs capture failures

### 2.4 Database Backups
- [x] PostgreSQL backup script deployed (2026-03-08): `/opt/docassistai/scripts/pg_backup.sh`
  - `pg_dump` custom format via `docker exec docassistai-postgres-1`
  - Cron: daily at 2 AM UTC → `/opt/docassistai/backups/daily/`
  - Retention: 7 daily + 4 weekly (Sunday copies)
  - Logs: `/var/log/docassistai-backup.log`
  - Test backup verified: 23K dump file created successfully
- [ ] Test backup restore procedure at least once
- [ ] Consider offsite backup (DigitalOcean Spaces) once user volume grows

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
- [x] Already complete — `vite.config.ts` has `name: 'DocAssistAI'`, `short_name: 'DocAI'`
- [x] `index.html` title and meta tags correct
- [x] All user-facing branding uses "DocAssistAI" consistently

### 4.2 Payment Methods & Pricing
- [ ] Priority: ensure Credit Card (Square embedded) works end-to-end in production
- [ ] Stretch: wire up ACH, Apple Pay, Google Pay (see `TODO-NEXT-SESSION.md` item #1)
- [ ] Remove Bitcoin from payment options (Square doesn't support recurring Bitcoin)
- [x] **$200/year annual subscription option implemented** (2026-03-08)
  - DB: `billing_cycle` column added to `scribe_users` (default: 'monthly')
  - Backend: `activateSubscription(userId, billingCycle)` — 30 days monthly, 365 days annual
  - Backend: payment handler accepts `billingCycle`, charges $20 or $200 accordingly
  - Backend: recurring billing reads `billing_cycle` for correct renewal amount
  - Backend: `/billing/options` returns both plans, `/billing/status` returns `billing_cycle`
  - Frontend: Monthly/Annual toggle on Account page and landing PricingCTA
  - Frontend: Registration page mentions both plan options
  - [ ] Update TOS to cover annual billing terms (prorated refund policy, renewal date)

### 4.3 Landing Page
- [x] Pricing CTA updated with Monthly/Annual toggle
- [x] TOS and Privacy Policy links in footer (done in Phase 1)
- [ ] Review and polish remaining landing page content

---

## Phase 5: Social Media & Marketing Campaign

### 5.1 Current Social Media Presence

The app already has social media accounts linked in the UI (`SocialMediaLinks.tsx`):

| Platform | Handle/URL | Status |
|----------|-----------|--------|
| LinkedIn | [/company/docassistai](https://www.linkedin.com/company/docassistai) | Created — needs content |
| X (Twitter) | [@docassistai_app](https://x.com/docassistai_app) | Created — needs content |
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

> Last updated: 2026-03-12 — includes Chart-to-Note and Billing Codes features

### Fixed Costs

| Item | Monthly Cost |
|------|-------------|
| DigitalOcean Droplet (4GB) | $24 |
| DigitalOcean Standard Support (BAA) | $99 |
| Vercel Pro | $20 |
| Domain (docassistai.app) | ~$1.25 |
| **Fixed costs** | **~$144/month** |

### Variable Costs Per User (300 encounters/month)

#### Scenario A: Record-Only User (all 300 encounters via audio recording)

| Item | Per-User Cost |
|------|--------------|
| Groq Whisper (transcription, 300 encounters) | ~$1.00 |
| Anthropic Haiku 4.5 (note generation, 300 calls) | ~$1.35 |
| Anthropic Sonnet 4.6 (focused AI, chat, ghost-write) | ~$1.88 |
| Anthropic Sonnet 4.6 (billing codes, ~150 notes = 50% usage) | ~$2.25 |
| Square processing (3.3% + $0.30) | ~$0.96 |
| **Variable cost per user** | **~$7.44/month** |

#### Scenario B: Mixed User (200 recorded + 100 chart-to-note)

| Item | Per-User Cost |
|------|--------------|
| Groq Whisper (transcription, 200 encounters) | ~$0.67 |
| Anthropic Haiku 4.5 (note generation, 200 recorded) | ~$0.90 |
| Anthropic Haiku 4.5 (chart-generate, 100 chart-to-note) | ~$0.55 |
| Anthropic Sonnet 4.6 (focused AI, chat, ghost-write) | ~$1.88 |
| Anthropic Sonnet 4.6 (billing codes, ~150 notes = 50% usage) | ~$2.25 |
| Square processing (3.3% + $0.30) | ~$0.96 |
| **Variable cost per user** | **~$7.21/month** |

#### Scenario C: Chart-Heavy User (50 recorded + 250 chart-to-note, e.g. hospitalist doing discharge summaries)

| Item | Per-User Cost |
|------|--------------|
| Groq Whisper (transcription, 50 encounters) | ~$0.17 |
| Anthropic Haiku 4.5 (note generation, 50 recorded) | ~$0.23 |
| Anthropic Haiku 4.5 (chart-generate, 250 chart-to-note) | ~$1.38 |
| Anthropic Sonnet 4.6 (focused AI, chat, ghost-write) | ~$1.88 |
| Anthropic Sonnet 4.6 (billing codes, ~200 notes = 67% usage) | ~$3.00 |
| Square processing (3.3% + $0.30) | ~$0.96 |
| **Variable cost per user** | **~$7.62/month** |

### Cost Notes

**Chart-to-Note vs. Record-to-Note**: Chart-to-note encounters skip Groq Whisper entirely (~$0.003/encounter saved). Anthropic input tokens are slightly higher for chart-generate (pasted chart data is typically longer than transcribed dictation), but the net cost is roughly neutral. Chart-heavy users save on transcription.

**Billing Codes (NEW — not in previous projections)**: The `/billing-codes` endpoint sends the full note text + transcript excerpt to Sonnet 4.6 and returns structured ICD-10 and CPT codes. Estimated ~$0.015/call. This is the most significant new cost line — at 50% usage (150 notes/month), it adds ~$2.25/user/month. At 100% usage (all 300 notes), ~$4.50/month. However, billing codes directly help users capture revenue (better coding = fewer denials, higher RVU capture), making this a high-value feature worth the cost.

**Chart-generate input sizes**: Pasted chart data (labs, imaging, med lists) averages ~1,500–3,000 input tokens vs. ~800–1,500 for a transcribed encounter. The per-call cost is ~$0.0055 vs. ~$0.0045 for standard generate — a marginal difference.

### Margin Analysis

#### Without Billing Codes (legacy projection)

| Pricing | Margin/User | Margin % | Break-Even |
|---------|------------|----------|------------|
| $20/month | ~$14.81 | 74% | ~10 users |
| $200/year ($16.67/mo) | ~$11.48/mo | 69% | ~13 users |

#### With Billing Codes @ 50% Usage (current projection)

| Pricing | Margin/User | Margin % | Break-Even |
|---------|------------|----------|------------|
| $20/month | ~$12.56 | 63% | ~12 users |
| $200/year ($16.67/mo) | ~$9.23/mo | 55% | ~16 users |

#### With Billing Codes @ 100% Usage (worst case)

| Pricing | Margin/User | Margin % | Break-Even |
|---------|------------|----------|------------|
| $20/month | ~$10.31 | 52% | ~14 users |
| $200/year ($16.67/mo) | ~$6.98/mo | 42% | ~21 users |

### Revenue Projections (12-month, monthly pricing only)

| Users | Monthly Revenue | Monthly Variable Cost | Monthly Margin (after fixed) | Annual Profit |
|-------|----------------|----------------------|------------------------------|---------------|
| 10 | $200 | $74 | -$18 (break-even zone) | -$216 |
| 25 | $500 | $186 | $170 | $2,040 |
| 50 | $1,000 | $372 | $484 | $5,808 |
| 100 | $2,000 | $744 | $1,112 | $13,344 |
| 250 | $5,000 | $1,860 | $2,996 | $35,952 |
| 500 | $10,000 | $3,720 | $6,136 | $73,632 |
| 1,000 | $20,000 | $7,440 | $12,416 | $149,000 |

*Assumes Scenario A (record-only + 50% billing codes) at $7.44/user/month. Mixed/chart-heavy users are slightly cheaper. Fixed costs of $144/month deducted from margin.*

### Strategic Cost Considerations

1. **Billing codes are opt-in**: Not every user will use them. Conservative 50% adoption is the baseline projection. Power users who use billing codes on every note are also the users most likely to retain — high engagement = low churn.

2. **Chart-to-Note is cost-neutral to cost-positive**: Saves transcription costs, slightly higher AI input costs. Net wash. But it opens an entirely new use case (chart review, discharge summaries from existing data) that competitors don't offer.

3. **Prompt caching mitigates Sonnet costs**: The billing-codes system prompt benefits from Anthropic prompt caching (90% savings on cached input tokens). Actual Sonnet costs may be 20-30% lower than listed above once caching hit rates stabilize.

4. **Scale efficiencies**: At 500+ users, consider negotiating volume pricing with Anthropic and Groq. At 1,000+ users, may need to upgrade Droplet ($48/month for 8GB) — still negligible vs. revenue.

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
