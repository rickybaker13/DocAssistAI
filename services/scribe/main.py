"""
DocAssistAI — Scribe Python Service

Handles the HIPAA-sensitive pipeline for the scribe module:
  Audio → faster-whisper → ICU vocab corrections → Presidio scrub
  → AWS Bedrock Claude → Presidio re-inject → response

Routes mirror the Railway Express backend so the frontend only needs a
different host (VITE_DO_SCRIBE_URL).
"""

import json
import logging
import os
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import bedrock_service as bedrock
import presidio_service as presidio
import whisper_service as whisper
from vocab_service import post_process_transcript

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="DocAssistAI Scribe Service", version="1.0.0")

# Allow requests from the Vercel frontend
CORS_ORIGINS = os.environ.get(
    "CORS_ORIGINS",
    "https://www.docassistai.app,http://localhost:8080",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Shared prompt constants (mirrors scribeAi.ts)
# ---------------------------------------------------------------------------

ICD10_INSTRUCTION = (
    "Use ICD-10-CM preferred terminology throughout. Examples: "
    "'essential (primary) hypertension' not 'high blood pressure'; "
    "'Type 2 diabetes mellitus' not 'diabetes' or 'diabetic'; "
    "specify systolic/diastolic and acute/chronic/acute-on-chronic for heart failure; "
    "'COPD with acute exacerbation' or 'COPD without acute exacerbation' not 'COPD' alone; "
    "'sequelae of CVA with [deficit]' not 'history of stroke' when deficits persist. "
    "Avoid 'history of [condition]' for conditions still actively managed."
)

TOKEN_PRESERVATION_INSTRUCTION = (
    "\nText may contain privacy-protection tokens in [TOKEN_N] format "
    "(e.g., [PERSON_0], [DATE_0], [MRN_0]). "
    "Preserve these tokens exactly as written — do not rephrase, remove, "
    "or modify any [BRACKET_N] token."
)

VERBOSITY_INSTRUCTIONS = {
    "brief": (
        "Write in clinical shorthand using standard medical abbreviations. "
        "Use sentence fragments — do NOT write complete sentences. "
        "Style example: \"D/C CTX; start meropenem 1g IV q8h, renally adj. "
        "ID consult placed.\""
    ),
    "detailed": (
        "Write in complete clinical prose with full sentences. "
        "Include clinical reasoning and context where relevant."
    ),
    "standard": (
        "Write 1–2 concise clinical sentences. "
        "Use medical abbreviations where natural (e.g., IV, q8h, D/C, s/p)."
    ),
}


def verbosity_instruction(v: str) -> str:
    return VERBOSITY_INSTRUCTIONS.get(v, VERBOSITY_INSTRUCTIONS["standard"])


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "scribe"}


# ---------------------------------------------------------------------------
# POST /api/ai/transcribe
# Accepts multipart audio, runs Whisper + vocab corrections, returns transcript.
# ---------------------------------------------------------------------------

@app.post("/api/ai/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str | None = Form(default=None),
):
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    raw_transcript = whisper.transcribe(audio_bytes, language=language)

    result = post_process_transcript(raw_transcript)

    if result.is_hallucination:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "hallucination_detected",
                "message": (
                    "The recording appears to contain non-clinical audio. "
                    "Please try recording again in a quieter environment."
                ),
            },
        )

    return {
        "transcript": result.transcript,
        "encounter_type": result.encounter_type,
        "corrections_applied": result.corrections_applied,
        "family_meeting_flag": result.family_meeting_flag,
    }


# ---------------------------------------------------------------------------
# POST /api/ai/scribe/generate
# Transcript + section templates → AI-generated note sections.
# ---------------------------------------------------------------------------

class SectionTemplate(BaseModel):
    name: str
    promptHint: str = ""


class GenerateRequest(BaseModel):
    transcript: str
    sections: list[SectionTemplate]
    noteType: str = "progress_note"
    verbosity: str = "standard"
    specialty: str = "hospital_medicine"


@app.post("/api/ai/scribe/generate")
async def generate_sections(req: GenerateRequest):
    section_list = "\n".join(
        f"- {s.name}" + (f" ({s.promptHint})" if s.promptHint else "")
        for s in req.sections
    )

    try:
        scrubbed_transcript, sub_map = await presidio.scrub(req.transcript)
    except presidio.PresidioError as exc:
        raise HTTPException(status_code=503, detail=f"Presidio unavailable: {exc}")

    system_prompt = (
        f"You are a clinical documentation AI assistant for a {req.specialty} physician.\n"
        "Generate structured note content for each section listed below, "
        "based ONLY on the transcript provided.\n"
        "Write in first-person plural physician voice "
        "(\"We assessed...\", \"The patient was...\", \"Our plan includes...\").\n"
        "Be clinically precise. Do not fabricate findings not present in the transcript.\n"
        "If a section cannot be completed from the transcript, write: "
        "\"Insufficient information captured.\"\n"
        "Return ONLY valid JSON — no markdown fences, no extra text.\n"
        f"{verbosity_instruction(req.verbosity)}\n"
        f"{ICD10_INSTRUCTION}{TOKEN_PRESERVATION_INSTRUCTION}"
    )

    user_prompt = (
        f'Transcript:\n"{scrubbed_transcript}"\n\n'
        f"Generate content for these sections:\n{section_list}\n\n"
        'Return JSON with this exact structure:\n'
        '{\n'
        '  "sections": [\n'
        '    { "name": "Section Name", "content": "Section text here", "confidence": 0.0 }\n'
        '  ]\n'
        '}\n'
        "Confidence is 0.0–1.0: 1.0 = fully supported by transcript, "
        "0.0 = not in transcript at all."
    )

    raw = bedrock.chat(
        messages=[{"role": "user", "content": user_prompt}],
        system=system_prompt,
        temperature=0.3,
    )

    # Re-inject PII
    raw = presidio.re_inject(raw, sub_map)

    try:
        data = json.loads(raw)
        sections = data.get("sections", [])
    except json.JSONDecodeError:
        # Fallback: treat entire response as assessment text
        sections = [{"name": "Assessment", "content": raw, "confidence": 0.5}]

    return {"sections": sections}


# ---------------------------------------------------------------------------
# POST /api/ai/scribe/focused
# Section analysis — returns analysis, citations, suggestions.
# ---------------------------------------------------------------------------

class FocusedRequest(BaseModel):
    sectionName: str
    content: str
    transcript: str = ""
    specialty: str = "hospital_medicine"


@app.post("/api/ai/scribe/focused")
async def focused_analysis(req: FocusedRequest):
    try:
        scrubbed_content, sub_map = await presidio.scrub(req.content)
        if req.transcript:
            scrubbed_transcript, t_sub_map = await presidio.scrub(req.transcript)
            sub_map.update(t_sub_map)
        else:
            scrubbed_transcript = ""
    except presidio.PresidioError as exc:
        raise HTTPException(status_code=503, detail=f"Presidio unavailable: {exc}")

    transcript_excerpt = (
        f'\nTranscript excerpt: "{scrubbed_transcript[:500]}"'
        if scrubbed_transcript else ""
    )

    system_prompt = (
        f"You are a senior {req.specialty} physician AI providing expert clinical analysis.\n"
        "Analyze the provided note section and return structured JSON only — "
        "no markdown, no extra text.\n"
        f"{ICD10_INSTRUCTION}{TOKEN_PRESERVATION_INSTRUCTION}"
    )

    user_prompt = (
        f"Analyze this note section and provide deep clinical insight.\n\n"
        f"Section: {req.sectionName}\n"
        f'Content: "{scrubbed_content}"{transcript_excerpt}\n'
        f"Specialty: {req.specialty}\n\n"
        "Return JSON:\n"
        "{\n"
        '  "analysis": "Expanded clinical reasoning and context for this section",\n'
        '  "citations": [\n'
        '    { "guideline": "Guideline name", "year": "2024", "recommendation": "Specific recommendation text" }\n'
        "  ],\n"
        '  "suggestions": ["Clinically relevant item the note may be missing"],\n'
        '  "confidence_breakdown": "Which claims are well-supported vs inferred"\n'
        "}\n\n"
        "For ICU sections, cite: Surviving Sepsis Campaign, ARDS Network, PADIS guidelines, AHA/ACC, NCS.\n"
        "For general medicine: ACC/AHA, IDSA, UpToDate-style evidence summaries.\n"
        "Keep each field concise. Suggestions should be actionable one-liners."
    )

    raw = bedrock.chat(
        messages=[{"role": "user", "content": user_prompt}],
        system=system_prompt,
        temperature=0.4,
    )

    raw = presidio.re_inject(raw, sub_map)

    try:
        data: dict[str, Any] = json.loads(raw)
    except json.JSONDecodeError:
        data = {
            "analysis": raw,
            "citations": [],
            "suggestions": [],
            "confidence_breakdown": "",
        }

    # Re-inject PII in nested string fields
    def reinject_nested(obj: Any) -> Any:
        if isinstance(obj, str):
            return presidio.re_inject(obj, sub_map)
        if isinstance(obj, list):
            return [reinject_nested(item) for item in obj]
        if isinstance(obj, dict):
            return {k: reinject_nested(v) for k, v in obj.items()}
        return obj

    return reinject_nested(data)


# ---------------------------------------------------------------------------
# POST /api/ai/scribe/ghost-write
# Converts clinical information into polished note text.
# ---------------------------------------------------------------------------

class GhostWriteRequest(BaseModel):
    chatAnswer: str
    destinationSection: str
    existingContent: str = ""
    noteType: str = "progress_note"
    verbosity: str = "standard"
    specialty: str = "hospital_medicine"


@app.post("/api/ai/scribe/ghost-write")
async def ghost_write(req: GhostWriteRequest):
    try:
        scrubbed_answer, sub_map = await presidio.scrub(req.chatAnswer)
    except presidio.PresidioError as exc:
        raise HTTPException(status_code=503, detail=f"Presidio unavailable: {exc}")

    existing_excerpt = (
        f'\nExisting section content (match this style):\n"{req.existingContent[:300]}"'
        if req.existingContent else ""
    )

    system_prompt = (
        "You are a clinical documentation AI. "
        "Convert clinical information into physician note text.\n"
        "Output ONLY the note text — no explanation, no JSON, no markdown, no preamble.\n"
        "Never include notes about transcription quality, source artifacts, "
        "uncertainty about the source material, or any meta-commentary.\n"
        "Never include caveats, disclaimers, or any text that would not appear "
        "verbatim in a physician's clinical note.\n"
        f"{ICD10_INSTRUCTION}{TOKEN_PRESERVATION_INSTRUCTION}"
    )

    user_prompt = (
        f'Convert the following clinical information into note text for the "{req.destinationSection}" section.\n'
        f"{verbosity_instruction(req.verbosity)}\n"
        "Match the style of the existing section content if provided.\n\n"
        f'Clinical information:\n"{scrubbed_answer}"\n\n'
        f"Note type: {req.noteType}\n"
        f"Specialty: {req.specialty}"
        f"{existing_excerpt}\n\n"
        "Output ONLY the note text. Nothing else."
    )

    raw = bedrock.chat(
        messages=[{"role": "user", "content": user_prompt}],
        system=system_prompt,
        temperature=0.5,
    )

    ghost_written = presidio.re_inject(raw, sub_map)
    return {"ghostWritten": ghost_written}


# ---------------------------------------------------------------------------
# POST /api/ai/scribe/resolve-suggestion
# Resolves a focused-analysis suggestion into ready-to-paste note text.
# ---------------------------------------------------------------------------

class ResolveSuggestionRequest(BaseModel):
    suggestion: str
    sectionName: str
    existingContent: str = ""
    transcript: str = ""
    noteType: str = "progress_note"
    verbosity: str = "standard"
    specialty: str = "hospital_medicine"


@app.post("/api/ai/scribe/resolve-suggestion")
async def resolve_suggestion(req: ResolveSuggestionRequest):
    try:
        scrubbed_suggestion, sub_map = await presidio.scrub(req.suggestion)
        if req.existingContent:
            sc, s_map = await presidio.scrub(req.existingContent)
            sub_map.update(s_map)
        else:
            sc = ""
        if req.transcript:
            st, t_map = await presidio.scrub(req.transcript)
            sub_map.update(t_map)
        else:
            st = ""
    except presidio.PresidioError as exc:
        raise HTTPException(status_code=503, detail=f"Presidio unavailable: {exc}")

    existing_part = f'\nExisting content:\n"{sc[:400]}"' if sc else ""
    transcript_part = f'\nTranscript:\n"{st[:800]}"' if st else ""

    system_prompt = (
        f"You are a clinical documentation AI for a {req.specialty} physician. "
        "Your job is to convert a documentation suggestion into actual physician note text.\n\n"
        "First, search the provided transcript and existing section content for the clinical "
        "detail referenced in the suggestion.\n"
        "- If the detail is present or unambiguously inferable → write the note text and return ready=true.\n"
        "- If a clinically critical detail is genuinely absent → return ready=false with a single "
        "focused clinical question and exactly 3 options.\n\n"
        "Rules for options when ready=false:\n"
        "- Provide exactly 3 options — the most clinically common and specific answers.\n"
        "- Options must be real clinical values (e.g. \"Left MCA\", \"HFrEF\", \"EF 35%\") — "
        "not vague placeholders.\n"
        "- Do NOT include escape options like \"Not yet determined\", \"Unknown\", or \"Other\".\n\n"
        f"Rules for note text when ready=true:\n{verbosity_instruction(req.verbosity)}\n"
        "Never include notes about transcription quality, source artifacts, or meta-commentary.\n"
        "Never include the suggestion text itself, caveats, or guidance.\n\n"
        f"Return ONLY valid JSON. No markdown fences. No extra text.\n"
        f"{ICD10_INSTRUCTION}{TOKEN_PRESERVATION_INSTRUCTION}"
    )

    user_prompt = (
        f'Suggestion to resolve: "{scrubbed_suggestion}"\n\n'
        f"Section: {req.sectionName}\n"
        f"Note type: {req.noteType}\n"
        f"Specialty: {req.specialty}"
        f"{existing_part}{transcript_part}\n\n"
        "Return one of these two JSON shapes:\n"
        '{ "ready": true, "noteText": "..." }\n'
        '{ "ready": false, "question": "...", "options": ["<value>", "<value>", "<value>"] }'
    )

    raw = bedrock.chat(
        messages=[{"role": "user", "content": user_prompt}],
        system=system_prompt,
        temperature=0.2,
    )

    raw = presidio.re_inject(raw, sub_map)

    try:
        data = json.loads(raw)
        if not isinstance(data.get("ready"), bool):
            raise ValueError("missing 'ready' bool")
    except (json.JSONDecodeError, ValueError):
        return {"ready": True, "noteText": raw}

    # Re-inject PII in string fields
    if data.get("ready"):
        data["noteText"] = presidio.re_inject(data.get("noteText", ""), sub_map)
    else:
        data["question"] = presidio.re_inject(data.get("question", ""), sub_map)
        data["options"] = [presidio.re_inject(o, sub_map) for o in data.get("options", [])]

    return data


# ---------------------------------------------------------------------------
# POST /api/ai/chat
# General clinical chat for the ScribeChatDrawer.
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    patientContext: str = ""
    specialty: str = "hospital_medicine"


@app.post("/api/ai/chat")
async def chat(req: ChatRequest):
    # Scrub all message content
    scrubbed_messages = []
    sub_map: dict[str, str] = {}
    try:
        for msg in req.messages:
            scrubbed_content, m_sub = await presidio.scrub(msg.content)
            sub_map.update(m_sub)
            scrubbed_messages.append({"role": msg.role, "content": scrubbed_content})
    except presidio.PresidioError as exc:
        raise HTTPException(status_code=503, detail=f"Presidio unavailable: {exc}")

    system_prompt = (
        f"You are a clinical documentation AI assistant for a {req.specialty} physician. "
        "Help with clinical note writing, summarisation, and documentation questions. "
        "Be concise and clinically precise.\n"
        f"{ICD10_INSTRUCTION}{TOKEN_PRESERVATION_INSTRUCTION}"
    )

    # Filter out system messages — pass them as the system parameter
    user_messages = [m for m in scrubbed_messages if m["role"] != "system"]

    raw = bedrock.chat(
        messages=user_messages,
        system=system_prompt,
        temperature=0.5,
    )

    content = presidio.re_inject(raw, sub_map)
    return {"success": True, "data": {"content": content}}
