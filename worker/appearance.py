"""
Appearance description via OpenRouter vision (gpt-4o-mini).
Used for matching people on exit when face is not visible.
"""

import os
import base64
import json
import logging
import requests
import cv2
import numpy as np

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
VISION_MODEL = os.getenv("OPENAI_VISION_MODEL", "gpt-4o-mini")

DESCRIBE_PROMPT = """Deskripsikan penampilan orang ini untuk identifikasi ulang. Fokus pada:
- Pakaian: warna dan jenis atasan (kemeja/jaket/kaos), warna dan jenis bawahan (celana/rok)
- Aksesoris: tas, topi, kacamata, masker
- Rambut: warna, panjang, gaya
- Postur tubuh: tinggi/pendek, kurus/gemuk

Jawab HANYA dalam JSON:
{"appearance": "deskripsi singkat dalam Bahasa Indonesia, maks 50 kata", "clothing_colors": ["warna1", "warna2"]}

Tanpa markdown. Tanpa penjelasan."""

MATCH_PROMPT_TEMPLATE = """Ada orang keluar (terlihat dari belakang). Cocokkan dengan salah satu orang yang masuk sebelumnya.

Orang keluar (gambar saat ini): analisis penampilannya dari belakang.

Orang yang masuk sebelumnya:
{candidates}

Jawab HANYA dalam JSON:
{{"best_match_uid": "uid yang paling cocok atau null jika tidak ada", "confidence": 0.0-1.0, "reason": "penjelasan singkat dalam Bahasa Indonesia"}}

Tanpa markdown. Tanpa penjelasan."""


def _call_vision(image_bytes: bytes, prompt: str) -> dict | None:
    if not OPENROUTER_API_KEY:
        logger.warning("[appearance] OPENROUTER_API_KEY not set, skipping")
        return None

    b64 = base64.b64encode(image_bytes).decode("ascii")

    try:
        res = requests.post(
            f"{OPENROUTER_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/cifo/security-worker",
                "X-Title": "CIFO Face Worker",
            },
            json={
                "model": VISION_MODEL,
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
                "max_tokens": 150,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{b64}",
                                    "detail": "low",
                                },
                            },
                        ],
                    }
                ],
            },
            timeout=15,
        )
        res.raise_for_status()
        raw = res.json()["choices"][0]["message"]["content"]
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"[appearance] vision call failed: {e}")
        return None


def describe_appearance(image_bytes: bytes) -> dict | None:
    return _call_vision(image_bytes, DESCRIBE_PROMPT)


def match_exit_to_entry(image_bytes: bytes, open_visits: dict) -> dict | None:
    if not open_visits:
        return None

    candidates = []
    for uid, visit in open_visits.items():
        desc = visit.get("appearance", "no description available")
        candidates.append(f"- UID: {uid}, appearance: {desc}")

    candidates_text = "\n".join(candidates)
    prompt = MATCH_PROMPT_TEMPLATE.format(candidates=candidates_text)

    return _call_vision(image_bytes, prompt)
