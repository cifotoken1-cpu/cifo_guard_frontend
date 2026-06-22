"""
VIGI Event Subscriber — Python port of backend/services/vigi/vigiEventListener.js
Long-polls subscribeMsg endpoint, parses multipart/mixed stream, yields events.
"""

import json
import time
import logging
import requests

logger = logging.getLogger(__name__)

SEPARATOR = b"----boundary--"


class EventSubscriber:
    def __init__(self, client, events=None, heartbeat: int = 15):
        self.client = client
        self.events = events or ["PeopleDetection"]
        self.heartbeat = heartbeat
        self._running = False
        self._backoff = 1.0
        self._max_backoff = 30.0

    def stop(self):
        self._running = False

    def subscribe(self):
        """Generator — yields event dicts. Reconnects on failure with backoff."""
        self._running = True

        while self._running:
            try:
                yield from self._connect()
                self._backoff = 1.0
            except (requests.exceptions.RequestException, Exception) as e:
                if not self._running:
                    break
                logger.warning(f"[event] connection error: {e}, retry in {self._backoff:.0f}s")

            if not self._running:
                break

            time.sleep(self._backoff)
            self._backoff = min(self._backoff * 2, self._max_backoff)

    def _connect(self):
        if not self.client.stok:
            self.client.login()

        url = f"{self.client.base_url}/stok={self.client.stok}"
        body = {
            "method": "subscribeMsg",
            "params": {
                "event_type": self.events,
                "heartbeat": self.heartbeat,
            },
        }

        logger.info(f"[event] subscribing to {self.events} at {url[:40]}...")

        # Fresh session for streaming — no Connection:close, no keep-alive reuse
        import requests as req
        stream_session = req.Session()
        stream_session.verify = False
        try:
            from vigi_client import _LegacyTLSAdapter
            stream_session.mount("https://", _LegacyTLSAdapter())
        except ImportError:
            pass

        resp = stream_session.post(
            url,
            json=body,
            stream=True,
            timeout=(10, None),  # connect=10s, read=infinite (like JS timeout:0)
        )

        status = resp.status_code
        content_type = resp.headers.get("Content-Type", "")
        logger.info(f"[event] response status={status} content-type={content_type}")

        if status != 200:
            logger.warning(f"[event] non-200 response: {status}")
            return

        buffer = b""
        chunk_count = 0
        for chunk in resp.iter_content(chunk_size=4096):
            if not self._running:
                break

            chunk_count += 1
            if chunk_count <= 3:
                logger.info(f"[event] chunk #{chunk_count} ({len(chunk)} bytes): {chunk[:100]}")

            buffer += chunk
            while SEPARATOR in buffer:
                idx = buffer.index(SEPARATOR)
                part = buffer[:idx]
                buffer = buffer[idx + len(SEPARATOR):]

                if part.strip():
                    event = self._parse_part(part)
                    if event:
                        yield event

        logger.info(f"[event] stream ended after {chunk_count} chunks")

    def _parse_part(self, part: bytes) -> dict | None:
        text = part.decode("utf-8", errors="ignore")
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end < start:
            logger.debug(f"[event] non-JSON part: {text[:80]}")
            return None

        try:
            payload = json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            logger.debug(f"[event] malformed JSON: {text[:80]}")
            return None

        if "Heartbeat" in payload:
            logger.info(f"[event] heartbeat: {payload['Heartbeat']}")
            return None
        elif payload.get("result") == "success":
            logger.info("[event] subscribed OK")
            return None
        elif payload.get("result") == "failed":
            logger.warning(f"[event] subscribe FAILED: {payload}")
            return None
        elif payload.get("event_type"):
            logger.info(f"[event] EVENT: {payload.get('event_type')} at {payload.get('time')}")
            return payload

        logger.debug(f"[event] unknown payload: {payload}")
        return None
