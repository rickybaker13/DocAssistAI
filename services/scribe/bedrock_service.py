"""
AWS Bedrock client.

Sends requests to Claude via the Bedrock Runtime API using the
anthropic_version: bedrock-2023-05-31 request format.
"""

import json
import os
from typing import Any

import boto3
from botocore.exceptions import ClientError, BotoCoreError

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
BEDROCK_MODEL = os.environ.get(
    "BEDROCK_MODEL", "anthropic.claude-3-5-sonnet-20241022-v2:0"
)

# Lazy singleton — created on first call so tests can patch before import
_client = None


def _get_client():
    global _client
    if _client is None:
        _client = boto3.client("bedrock-runtime", region_name=AWS_REGION)
    return _client


class BedrockError(Exception):
    """Raised on Bedrock API errors."""


def chat(
    messages: list[dict[str, str]],
    system: str | None = None,
    temperature: float = 0.4,
    max_tokens: int = 4096,
) -> str:
    """
    Send a chat request to Claude via Bedrock and return the assistant's text.

    *messages* should be a list of {"role": "user"|"assistant", "content": str}
    dicts (no system role — pass *system* separately).
    """
    body: dict[str, Any] = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": messages,
    }
    if system:
        body["system"] = system

    try:
        response = _get_client().invoke_model(
            modelId=BEDROCK_MODEL,
            body=json.dumps(body),
            contentType="application/json",
            accept="application/json",
        )
    except (ClientError, BotoCoreError) as exc:
        raise BedrockError(str(exc)) from exc

    result = json.loads(response["body"].read())
    try:
        return result["content"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise BedrockError(f"Unexpected Bedrock response shape: {result}") from exc
