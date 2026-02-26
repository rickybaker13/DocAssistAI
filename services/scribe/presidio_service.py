"""
Presidio PII scrubbing client.

Calls the Presidio analyzer and anonymizer sidecars (running as Docker
containers on the same Docker network) to scrub PHI from text before it is
sent to AWS Bedrock, and to re-inject the original tokens after.
"""

import os
from typing import Any
import httpx

ANALYZER_URL = os.environ.get("PRESIDIO_ANALYZER_URL", "http://presidio-analyzer:5002")
ANONYMIZER_URL = os.environ.get("PRESIDIO_ANONYMIZER_URL", "http://presidio-anonymizer:5001")
MIN_SCORE = float(os.environ.get("PRESIDIO_MIN_SCORE", "0.7"))
TIMEOUT = float(os.environ.get("PRESIDIO_TIMEOUT_MS", "5000")) / 1000  # convert to seconds

# Entities Presidio should detect
ENTITIES = [
    "PERSON",
    "PHONE_NUMBER",
    "US_SSN",
    "DATE_TIME",
    "MEDICAL_RECORD_NUMBER",
    "US_DRIVER_LICENSE",
    "EMAIL_ADDRESS",
    "LOCATION",
    "AGE",
]


class PresidioError(Exception):
    """Raised when Presidio is unreachable or returns an error."""


async def scrub(text: str) -> tuple[str, dict[str, str]]:
    """
    Scrub PII from *text*.

    Returns (scrubbed_text, substitution_map) where substitution_map maps
    token → original value so that re_inject can restore them.
    """
    if not text or not text.strip():
        return text, {}

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        # Step 1: analyze
        try:
            analyze_resp = await client.post(
                f"{ANALYZER_URL}/analyze",
                json={
                    "text": text,
                    "language": "en",
                    "entities": ENTITIES,
                    "score_threshold": MIN_SCORE,
                },
            )
            analyze_resp.raise_for_status()
        except (httpx.ConnectError, httpx.TimeoutException) as exc:
            raise PresidioError(f"Presidio analyzer unreachable: {exc}") from exc

        results: list[dict[str, Any]] = analyze_resp.json()
        if not results:
            return text, {}

        # Step 2: anonymize
        # Build operator config so each entity type gets a consistent token format
        operators: dict[str, dict] = {}
        for entity_type in ENTITIES:
            operators[entity_type] = {
                "type": "replace",
                "new_value": f"[{entity_type}_0]",  # placeholder; Presidio auto-increments
            }

        try:
            anon_resp = await client.post(
                f"{ANONYMIZER_URL}/anonymize",
                json={
                    "text": text,
                    "anonymizers": operators,
                    "analyzer_results": results,
                },
            )
            anon_resp.raise_for_status()
        except (httpx.ConnectError, httpx.TimeoutException) as exc:
            raise PresidioError(f"Presidio anonymizer unreachable: {exc}") from exc

        anon_data = anon_resp.json()
        scrubbed = anon_data.get("text", text)

        # Build reverse map: token → original span text
        sub_map: dict[str, str] = {}
        for item in anon_data.get("items", []):
            token = item.get("text", "")        # the replacement token (e.g. "[PERSON_0]")
            start = item.get("start", 0)
            end = item.get("end", 0)
            original = text[start:end] if start < end <= len(text) else ""
            if token and original:
                sub_map[token] = original

        return scrubbed, sub_map


def re_inject(text: str, sub_map: dict[str, str]) -> str:
    """Replace all tokens in *text* with their original values from *sub_map*."""
    if not sub_map:
        return text
    result = text
    for token, original in sub_map.items():
        result = result.replace(token, original)
    return result
