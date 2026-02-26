"""
ICU vocab post-processor.

Three pure functions that run on every Whisper transcript before it reaches
Presidio and Bedrock:
 - detect_hallucination  — catch Whisper artifacts (YouTube credits, repetition)
 - apply_icu_corrections — normalise drug names, scoring systems, device names
 - classify_encounter    — tag encounter type for downstream routing
"""

import re
from dataclasses import dataclass, field
from typing import Literal

# ---------------------------------------------------------------------------
# Encounter type
# ---------------------------------------------------------------------------

EncounterType = Literal[
    "pre_rounds_dictation",
    "family_meeting",
    "procedure_note",
    "admission_note",
    "handoff",
    "bedside_assessment",
]


# ---------------------------------------------------------------------------
# Hallucination detection
# ---------------------------------------------------------------------------

_HALLUCINATION_PATTERNS = [
    re.compile(r"\[music\]", re.IGNORECASE),
    re.compile(r"\[applause\]", re.IGNORECASE),
    re.compile(r"\[laughter\]", re.IGNORECASE),
    re.compile(r"thanks? for watching", re.IGNORECASE),
    re.compile(r"subscribe to (our|my|the) channel", re.IGNORECASE),
    re.compile(r"like and subscribe", re.IGNORECASE),
    re.compile(r"subtitles? by", re.IGNORECASE),
    # Four or more consecutive identical words separated by spaces
    re.compile(r"\b(\w+)(?:\s+\1){3,}\b", re.IGNORECASE),
]


def detect_hallucination(text: str) -> bool:
    """Return True if the transcript contains Whisper hallucination artifacts."""
    return any(p.search(text) for p in _HALLUCINATION_PATTERNS)


# ---------------------------------------------------------------------------
# ICU vocabulary corrections
# ---------------------------------------------------------------------------

# Each tuple: (pattern, replacement)
# Patterns are case-insensitive, whole-word-aware where appropriate.
_ICU_CORRECTIONS: list[tuple[re.Pattern, str]] = [
    # Drug names — common Whisper mishearings
    (re.compile(r"\bnorepinephrine?\b", re.IGNORECASE), "norepinephrine"),
    (re.compile(r"\bnorepi\b", re.IGNORECASE), "norepinephrine"),
    (re.compile(r"\bvasopressin\b", re.IGNORECASE), "vasopressin"),
    (re.compile(r"\bvancomy?cin\b", re.IGNORECASE), "vancomycin"),
    (re.compile(r"\bpiperacillin.?tazobactam\b", re.IGNORECASE), "piperacillin-tazobactam"),
    (re.compile(r"\bpip.?tazo?\b", re.IGNORECASE), "piperacillin-tazobactam"),
    (re.compile(r"\bmeropenem\b", re.IGNORECASE), "meropenem"),
    (re.compile(r"\bcefepime\b", re.IGNORECASE), "cefepime"),
    (re.compile(r"\bpropofol\b", re.IGNORECASE), "propofol"),
    (re.compile(r"\bfentanyl\b", re.IGNORECASE), "fentanyl"),
    (re.compile(r"\bdexmedetomidine\b", re.IGNORECASE), "dexmedetomidine"),
    (re.compile(r"\bprecedex\b", re.IGNORECASE), "dexmedetomidine"),
    (re.compile(r"\bmidazolam\b", re.IGNORECASE), "midazolam"),
    (re.compile(r"\blocabivenol\b", re.IGNORECASE), "lorazepam"),
    (re.compile(r"\blorazepam\b", re.IGNORECASE), "lorazepam"),
    (re.compile(r"\bhydrocortisone\b", re.IGNORECASE), "hydrocortisone"),
    (re.compile(r"\binsulin\b", re.IGNORECASE), "insulin"),
    (re.compile(r"\bheparin\b", re.IGNORECASE), "heparin"),
    (re.compile(r"\bfurosemide\b", re.IGNORECASE), "furosemide"),
    (re.compile(r"\blasix\b", re.IGNORECASE), "furosemide"),
    # Scoring systems
    (re.compile(r"\bapache\s*(?:two|2|ii)\b", re.IGNORECASE), "APACHE II"),
    (re.compile(r"\bsofa\b", re.IGNORECASE), "SOFA"),
    (re.compile(r"\bcam.?icu\b", re.IGNORECASE), "CAM-ICU"),
    (re.compile(r"\bbis\b", re.IGNORECASE), "BIS"),
    (re.compile(r"\brass\b", re.IGNORECASE), "RASS"),
    (re.compile(r"\bcpis\b", re.IGNORECASE), "CPIS"),
    # Devices and modalities
    (re.compile(r"\bcrrt\b", re.IGNORECASE), "CRRT"),
    (re.compile(r"\bcvvhd\b", re.IGNORECASE), "CVVHD"),
    (re.compile(r"\becmo\b", re.IGNORECASE), "ECMO"),
    (re.compile(r"\biabp\b", re.IGNORECASE), "IABP"),
    (re.compile(r"\bimpella\b", re.IGNORECASE), "Impella"),
    (re.compile(r"\bpicc\b", re.IGNORECASE), "PICC"),
    (re.compile(r"\bcvl\b", re.IGNORECASE), "CVL"),
    (re.compile(r"\bart(?:erial)?\s+line\b", re.IGNORECASE), "arterial line"),
    (re.compile(r"\ba.?line\b", re.IGNORECASE), "arterial line"),
    (re.compile(r"\bpac\b", re.IGNORECASE), "PAC"),
    (re.compile(r"\bnippv\b", re.IGNORECASE), "NIPPV"),
    (re.compile(r"\bcpap\b", re.IGNORECASE), "CPAP"),
    (re.compile(r"\bbipap\b", re.IGNORECASE), "BiPAP"),
    (re.compile(r"\bnasogastric\b", re.IGNORECASE), "nasogastric"),
    (re.compile(r"\bng\s+tube\b", re.IGNORECASE), "NG tube"),
    # Diagnoses
    (re.compile(r"\bards\b", re.IGNORECASE), "ARDS"),
    (re.compile(r"\bdic\b", re.IGNORECASE), "DIC"),
    (re.compile(r"\buti\b", re.IGNORECASE), "UTI"),
    (re.compile(r"\bcap\b\s+(?=pneumonia)", re.IGNORECASE), "CAP "),
    (re.compile(r"\bhap\b\s+(?=pneumonia)", re.IGNORECASE), "HAP "),
    (re.compile(r"\bvap\b", re.IGNORECASE), "VAP"),
]


def apply_icu_corrections(text: str) -> tuple[str, list[str]]:
    """
    Apply ICU vocabulary normalisation.

    Returns (corrected_text, list_of_applied_corrections).
    """
    corrections: list[str] = []
    result = text
    for pattern, replacement in _ICU_CORRECTIONS:
        new, n = pattern.subn(replacement, result)
        if n > 0:
            corrections.append(replacement)
            result = new
    return result, corrections


# ---------------------------------------------------------------------------
# Encounter classification
# ---------------------------------------------------------------------------

_ENCOUNTER_RULES: list[tuple[re.Pattern, EncounterType]] = [
    (re.compile(r"\bfamily\s+(?:meeting|conference|discussion)\b", re.IGNORECASE), "family_meeting"),
    (re.compile(r"\bgoals?\s+of\s+care\b", re.IGNORECASE), "family_meeting"),
    (re.compile(r"\bcode\s+status\b", re.IGNORECASE), "family_meeting"),
    (re.compile(r"\bpalliative\b", re.IGNORECASE), "family_meeting"),
    (re.compile(r"\bprocedure\s+note\b", re.IGNORECASE), "procedure_note"),
    (re.compile(r"\bcatheter(?:isation|ization)?\b", re.IGNORECASE), "procedure_note"),
    (re.compile(r"\bintubat(?:ed|ion)\b", re.IGNORECASE), "procedure_note"),
    (re.compile(r"\bbronchoscop(?:y|ic)\b", re.IGNORECASE), "procedure_note"),
    (re.compile(r"\bthoracentesis\b", re.IGNORECASE), "procedure_note"),
    (re.compile(r"\bparacentesis\b", re.IGNORECASE), "procedure_note"),
    (re.compile(r"\badmission\s+note\b", re.IGNORECASE), "admission_note"),
    (re.compile(r"\bhistory\s+(?:and|&)\s+physical\b", re.IGNORECASE), "admission_note"),
    (re.compile(r"\bh\s*(?:and|&)\s*p\b", re.IGNORECASE), "admission_note"),
    (re.compile(r"\bhandoff\b", re.IGNORECASE), "handoff"),
    (re.compile(r"\bsign.?out\b", re.IGNORECASE), "handoff"),
    (re.compile(r"\bsbar\b", re.IGNORECASE), "handoff"),
    (re.compile(r"\bpre.?rounds?\b", re.IGNORECASE), "pre_rounds_dictation"),
    (re.compile(r"\bmorning\s+rounds?\b", re.IGNORECASE), "pre_rounds_dictation"),
]


def classify_encounter(text: str) -> EncounterType:
    """Return the best-matching encounter type for the transcript."""
    for pattern, etype in _ENCOUNTER_RULES:
        if pattern.search(text):
            return etype
    return "bedside_assessment"


# ---------------------------------------------------------------------------
# Combined post-processor
# ---------------------------------------------------------------------------

@dataclass
class TranscriptResult:
    transcript: str
    encounter_type: EncounterType
    corrections_applied: list[str] = field(default_factory=list)
    is_hallucination: bool = False
    family_meeting_flag: bool = False


def post_process_transcript(raw: str) -> TranscriptResult:
    """Run all post-processing steps and return a structured result."""
    if detect_hallucination(raw):
        return TranscriptResult(
            transcript=raw,
            encounter_type="bedside_assessment",
            is_hallucination=True,
        )

    corrected, corrections = apply_icu_corrections(raw)
    encounter_type = classify_encounter(corrected)

    return TranscriptResult(
        transcript=corrected,
        encounter_type=encounter_type,
        corrections_applied=corrections,
        is_hallucination=False,
        family_meeting_flag=(encounter_type == "family_meeting"),
    )
