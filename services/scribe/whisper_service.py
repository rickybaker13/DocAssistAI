"""
faster-whisper transcription service.

Loads the model once at startup (lazy singleton on first request) and
transcribes audio bytes into text.
"""

import io
import logging
import os
from threading import Lock

from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "large-v3")
DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")

_model: WhisperModel | None = None
_lock = Lock()


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        with _lock:
            if _model is None:  # double-checked locking
                logger.info(
                    "Loading faster-whisper model %s on %s (%s)…",
                    MODEL_SIZE,
                    DEVICE,
                    COMPUTE_TYPE,
                )
                _model = WhisperModel(
                    MODEL_SIZE,
                    device=DEVICE,
                    compute_type=COMPUTE_TYPE,
                )
                logger.info("faster-whisper model loaded.")
    return _model


def transcribe(audio_bytes: bytes, language: str | None = None) -> str:
    """
    Transcribe *audio_bytes* (any format ffmpeg understands — webm, mp4, etc.)
    and return the full transcript as a single string.
    """
    model = _get_model()
    audio_io = io.BytesIO(audio_bytes)

    kwargs: dict = {
        "beam_size": 5,
        "word_timestamps": False,
        "condition_on_previous_text": True,
        # Medical/clinical vocabulary bias (no_speech_threshold tuned slightly
        # higher to reduce spurious segments during silence between utterances)
        "no_speech_threshold": 0.65,
        "log_prob_threshold": -1.0,
    }
    if language:
        kwargs["language"] = language

    segments, _info = model.transcribe(audio_io, **kwargs)
    return " ".join(seg.text.strip() for seg in segments if seg.text.strip())
