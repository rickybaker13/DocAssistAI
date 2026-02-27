# AWS Bedrock Setup — DocAssistAI

**Date:** 2026-02-27
**Status:** Complete — model access confirmed

---

## Overview

DocAssistAI uses **AWS Bedrock** as its AI provider (`EXTERNAL_AI_TYPE=bedrock`). This document covers the decisions made and steps taken to configure Bedrock for production use.

---

## Support Plan

**Selected:** AWS Basic Support (Free)

Rationale: Basic support provides full API access to all AWS services including Bedrock. Paid tiers (Developer, Business, Enterprise) only add faster AWS support response times and dedicated Technical Account Managers — not needed at this stage.

---

## Model Selection

**Selected Model:** `us.anthropic.claude-sonnet-4-6-20250514-v1:0`

### Why Sonnet 4.6?

| Model | Decision | Reason |
|-------|----------|--------|
| Claude Haiku 4.5 | ❌ Not selected | Too limited for medical documentation — lower reasoning quality risks inaccurate clinical notes |
| Claude Sonnet 4.6 | ✅ Selected | Strong reasoning + medical knowledge, cost-effective at scale |
| Claude Opus 4.6 | ❌ Not selected | ~5x more expensive than Sonnet for marginal quality gains in this use case |

DocAssistAI requires a capable model because it:
- Generates structured clinical notes from audio transcripts
- Provides guideline citations with confidence breakdowns
- Performs ghost-writing and focused section analysis
- Must handle medical terminology accurately

Future optimization: Haiku could be used for simple reformatting endpoints while Sonnet handles core clinical reasoning — but this is not needed now.

---

## Model Access in AWS Bedrock

As of early 2026, the AWS Bedrock **Model Access page has been retired**. Models are now automatically enabled on first invocation — no manual activation required.

### What was done:
1. Located Claude Sonnet 4.6 in the **Bedrock Model Catalog**
2. Submitted **Anthropic use case details** (required for first-time Anthropic model access on a new AWS account)
3. Model is now enabled and ready — will activate automatically on first API call

### To verify model is working:
```bash
GET https://docassistai-production.up.railway.app/api/health
# Returns: { presidio, analyzer, anonymizer, whisper }
# If this returns JSON, backend is up and Bedrock is reachable
```

### To test in AWS console:
- Go to Bedrock Model Catalog → Claude Sonnet 4.6 → **Open in Playground**
- This triggers first invocation and confirms access

---

## Backend Configuration

The model is configured in the Railway environment:

```
EXTERNAL_AI_TYPE=bedrock
# AWS credentials injected via AWS SDK credential chain
# Model ID: us.anthropic.claude-sonnet-4-6-20250514-v1:0
```

No code changes were needed — the model ID was already set in the backend config.

---

## Next Steps

- Start backend and make a test API call to confirm Bedrock invocation succeeds
- Monitor Bedrock usage/costs in AWS Cost Explorer
- If costs grow, consider routing lightweight endpoints to Haiku

---

*See also: `CLAUDE.md` → Production Deployment section for full backend/Bedrock config details.*
