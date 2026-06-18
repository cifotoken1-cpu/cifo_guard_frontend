import logging
from datetime import datetime, timezone
from api_client import post_visit_entry, close_visit

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class VisitTracker:
    """
    Tracks open visits per person (track_id).

    When a track crosses "in":  open a visit in backend, store visit_id.
    When a track crosses "out": close the visit with exit_time.
    When ByteTrack loses a track (disappeared without "out"): leave visit open
    — backend /visits/duration-summary excludes open visits from avg.
    """

    def __init__(self):
        # track_id → {"visit_id": str, "entry_time": str}
        self._open: dict[int, dict] = {}

    def on_entry(self, track_id: int):
        if track_id in self._open:
            # Already inside — ignore duplicate crossing
            return

        entry_time = _now_iso()
        person_uid = f"track-{track_id}"
        visit_id = post_visit_entry(person_uid=person_uid, entry_time=entry_time)
        if visit_id:
            self._open[track_id] = {"visit_id": visit_id, "entry_time": entry_time}
            logger.debug(f"[visit] opened track={track_id} visit={visit_id}")

    def on_exit(self, track_id: int):
        record = self._open.pop(track_id, None)
        if record is None:
            # Exit without known entry — can happen if worker started mid-session
            logger.debug(f"[visit] exit for unknown track={track_id}, skipping")
            return

        exit_time = _now_iso()
        close_visit(visit_id=record["visit_id"], exit_time=exit_time)
        logger.debug(f"[visit] closed track={track_id} visit={record['visit_id']}")

    def on_track_lost(self, track_id: int):
        """ByteTrack dropped the track — remove from memory without closing visit."""
        self._open.pop(track_id, None)

    @property
    def open_count(self) -> int:
        return len(self._open)
