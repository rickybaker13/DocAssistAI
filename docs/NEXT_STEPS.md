# Next Steps — Getting DocAssistAI Fully Operational

## Immediate (Do First)

### 1. Verify AI Service After Throttle Reset
The Bedrock daily token limit resets at midnight UTC. After that:
```bash
# On the droplet:
curl -s -X POST https://api.docassistai.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Say hello in 5 words"}]}' | jq .
```
Expected: `{ "success": true, "data": { "content": "..." } }`

If it still fails with throttling, check the [AWS Service Quotas console](https://console.aws.amazon.com/servicequotas/) for Bedrock token limits and request an increase.

### 2. End-to-End Transcription Test
Once AI is responding, test the full flow from the frontend:
1. Log in at `https://www.docassistai.app/scribe/login`
2. Create a new note (select template, sections)
3. Record a short test encounter (e.g., "Patient is a 45-year-old male presenting with chest pain...")
4. Verify: audio → Whisper transcription → AI note generation → sections populated

If transcription fails, check Whisper logs:
```bash
docker logs infra-whisper-1 --tail 50
```

---

## Architecture Overview (How the Pieces Connect)

```
Browser (mic) → AudioRecorder component
    ↓ audio blob (webm/mp4)
POST /api/ai/transcribe (multipart upload)
    ↓ WhisperService → self-hosted Whisper container (port 9000)
    ↓ returns { transcript: "..." }
Frontend receives transcript
    ↓
POST /api/ai/scribe/generate
    ↓ PII Scrubber (Presidio) strips PHI → [PERSON_0], [DATE_0], etc.
    ↓ Claude (Bedrock) generates structured JSON sections
    ↓ PII re-injected into response
    ↓ returns { sections: [{ name, content, confidence }] }
Frontend displays generated note in NoteCanvas
```

**Post-generation AI features (all working, just need AI access):**
- `/api/ai/scribe/focused` — Deep analysis of a single note section (citations, suggestions)
- `/api/ai/scribe/ghost-write` — Converts chat answers into note-ready text
- `/api/ai/scribe/resolve-suggestion` — Turns AI suggestions into actionable note content
- `/api/ai/chat` — General clinical chat with optional patient context

---

## Short-Term (This Week)

### 3. Bedrock Quota Increase
New Bedrock marketplace subscriptions have very low default token limits. Request a quota increase:
- Go to **AWS Service Quotas → Amazon Bedrock**
- Find the tokens-per-minute and tokens-per-day limits for Claude Sonnet 4.6
- Request an increase appropriate for production usage

### 4. Clean Up Old Docker Containers
Old `docassistai-*` containers from the previous compose project are still on the droplet (stopped). Remove them:
```bash
docker rm docassistai-caddy-1 docassistai-backend-1 docassistai-postgres-1 \
  docassistai-whisper-1 docassistai-presidio-anonymizer-1 docassistai-presidio-analyzer-1
docker volume prune  # removes unused volumes (will prompt)
```

### 5. Merge the Branch
Once AI is confirmed working end-to-end:
```bash
# Create PR from claude/fix-ses-sandbox-config-CBErR → main
gh pr create --title "fix: update Bedrock model to Claude Sonnet 4.6" \
  --body "Switches from legacy Claude 3.7 Sonnet to Claude Sonnet 4.6. Adds Caddy DNS fix and Marketplace IAM permissions documentation."
```
Then deploy to production:
```bash
ssh root@159.203.87.97 'cd /opt/docassistai && git pull origin main && docker compose -f infra/docker-compose.prod.yml up -d --build'
```

---

## Medium-Term (Next 1–2 Weeks)

### 6. Email Service (SES)
Not yet implemented. Needed for:
- **Email verification on signup** — prevent fake email registrations
- **Password reset / forgot password flow**
- **Invite links** for new users

Steps when ready:
1. Add `@aws-sdk/client-ses` to backend dependencies
2. Create `backend/src/services/email/sesService.ts`
3. Add routes for password reset and email verification
4. Configure SES in AWS (verify domain, request production access to exit sandbox)
5. Add `SES_FROM_EMAIL`, `SES_REGION` env vars

### 7. Bedrock `ListFoundationModels` Permission
The IAM user currently cannot list available models (`bedrock:ListFoundationModels` denied). Add this to the IAM policy if you want to programmatically check model availability:
```json
{
  "Effect": "Allow",
  "Action": ["bedrock:ListFoundationModels"],
  "Resource": "*"
}
```

### 8. Frontend Error Handling for AI Throttling
Currently, if Bedrock returns a throttling error, the user sees a raw error message. Consider adding:
- A user-friendly "AI service is temporarily busy, please try again in a moment" message
- Automatic retry with exponential backoff for transient throttle errors in the Bedrock provider

---

## Longer-Term

### 9. Streaming Responses
The current Bedrock provider uses `InvokeModelCommand` (non-streaming). For better UX on long note generations, switch to `InvokeModelWithResponseStreamCommand` so users see text appear progressively.

### 10. RAG / Patient Data Indexing
The codebase has `backend/src/services/rag/` with embedding service, vector store, and patient data indexer — but these require an embedding API key that isn't configured. When ready:
- Configure embedding service (OpenAI embeddings or Bedrock Titan Embeddings)
- Index patient data for context-aware responses

### 11. HIPAA Compliance Checklist
See `docs/HIPAA_COMPLIANCE_NEXT_STEPS.md` for the full checklist. Key remaining items:
- BAA with AWS (for Bedrock + SES)
- BAA with DigitalOcean (for the droplet)
- Audit log persistence and rotation
- Encryption at rest verification
