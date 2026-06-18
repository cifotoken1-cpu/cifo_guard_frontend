import requests
import logging
from datetime import datetime, timezone
from config import BACKEND_URL, BACKEND_TOKEN, CAMERA_ID

logger = logging.getLogger(__name__)

_session = requests.Session()
_session.headers.update({
    "Authorization": f"Bearer {BACKEND_TOKEN}",
    "Content-Type": "application/json",
})


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def post_crossing_event(direction: str, crossed_at: str = None) -> bool:
    """POST /counting/event — called by worker on each line crossing."""
    payload = {
        "camera_id": CAMERA_ID,
        "direction": direction,
        "crossed_at": crossed_at or _now_iso(),
    }
    try:
        res = _session.post(f"{BACKEND_URL}/counting/event", json=payload, timeout=5)
        if res.status_code == 201:
            logger.debug(f"[api] crossing {direction} posted OK")
            return True
        else:
            logger.warning(f"[api] crossing POST {res.status_code}: {res.text[:200]}")
            return False
    except requests.exceptions.RequestException as e:
        logger.warning(f"[api] crossing POST failed: {e}")
        return False


def post_visit_entry(person_uid: str, entry_time: str = None) -> str | None:
    """POST /visits — open a new person visit, returns visit_id."""
    payload = {
        "camera_id": CAMERA_ID,
        "person_uid": person_uid,
        "entry_time": entry_time or _now_iso(),
        "match_method": "bytetrack",
    }
    try:
        res = _session.post(f"{BACKEND_URL}/visits", json=payload, timeout=5)
        if res.status_code == 201:
            visit_id = res.json().get("data", {}).get("id")
            logger.debug(f"[api] visit open {person_uid} → {visit_id}")
            return visit_id
        else:
            logger.warning(f"[api] visit POST {res.status_code}: {res.text[:200]}")
            return None
    except requests.exceptions.RequestException as e:
        logger.warning(f"[api] visit POST failed: {e}")
        return None


def close_visit(visit_id: str, exit_time: str = None) -> bool:
    """PATCH /visits/:id/close — record exit time and duration."""
    payload = {"exit_time": exit_time or _now_iso()}
    try:
        res = _session.patch(f"{BACKEND_URL}/visits/{visit_id}/close", json=payload, timeout=5)
        if res.status_code == 200:
            logger.debug(f"[api] visit closed {visit_id}")
            return True
        else:
            logger.warning(f"[api] visit PATCH {res.status_code}: {res.text[:200]}")
            return False
    except requests.exceptions.RequestException as e:
        logger.warning(f"[api] visit PATCH failed: {e}")
        return False


def health_check() -> bool:
    """Ping backend health endpoint — used by Docker healthcheck."""
    try:
        res = requests.get(
            f"{BACKEND_URL.replace('/api', '')}/health",
            timeout=3
        )
        return res.status_code == 200
    except Exception:
        return False
