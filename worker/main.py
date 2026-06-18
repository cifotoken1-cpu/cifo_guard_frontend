"""
CCTV AI Count — Python Vision Worker
Reads RTSP stream, detects persons via YOLO nano + ByteTrack,
detects virtual line crossings, and POSTs events to backend API.
"""

import logging
import signal
import sys
import time
import cv2

from config import SHOW_PREVIEW, CAMERA_ID
from rtsp_reader import RTSPReader
from detector import PersonDetector
from line_crossing import LineCrossingDetector
from visit_tracker import VisitTracker
from api_client import post_crossing_event, health_check

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("main")

# ── graceful shutdown ────────────────────────────────────────────────────────
_running = True

def _handle_signal(sig, frame):
    global _running
    logger.info(f"[main] received signal {sig}, shutting down...")
    _running = False

signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)

# ── startup health check ─────────────────────────────────────────────────────
def wait_for_backend(retries: int = 10, delay: int = 3):
    for i in range(retries):
        if health_check():
            logger.info("[main] backend reachable")
            return True
        logger.warning(f"[main] backend not ready, retry {i+1}/{retries}...")
        time.sleep(delay)
    logger.error("[main] backend unreachable after retries — exiting")
    return False


def main():
    logger.info(f"[main] starting worker for camera={CAMERA_ID}")

    if not wait_for_backend():
        sys.exit(1)

    reader = RTSPReader()
    detector = PersonDetector()
    crossing = LineCrossingDetector()
    visits = VisitTracker()

    # track which ids were active last frame — detect disappearances
    prev_active_ids: set[int] = set()

    frame_count = 0
    log_interval = 300  # log stats every N frames

    try:
        for frame, frame_w, frame_h in reader.frames():
            if not _running:
                break

            detections, active_ids = detector.detect(frame)

            # detect lost tracks — person disappeared without crossing out
            lost_ids = prev_active_ids - active_ids
            for tid in lost_ids:
                crossing.remove_track(tid)
                visits.on_track_lost(tid)

            prev_active_ids = active_ids

            for det in detections:
                direction = crossing.update(det.track_id, det.cx, det.cy)
                if direction:
                    post_crossing_event(direction=direction)
                    if direction == "in":
                        visits.on_entry(det.track_id)
                    else:
                        visits.on_exit(det.track_id)

            frame_count += 1
            if frame_count % log_interval == 0:
                logger.info(
                    f"[main] frames={frame_count} "
                    f"tracked={len(active_ids)} "
                    f"open_visits={visits.open_count}"
                )

            if SHOW_PREVIEW:
                _draw_preview(frame, frame_w, frame_h, detections, crossing)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

    finally:
        reader.release()
        if SHOW_PREVIEW:
            cv2.destroyAllWindows()
        logger.info(f"[main] stopped. total frames processed: {frame_count}")


def _draw_preview(frame, frame_w, frame_h, detections, crossing: LineCrossingDetector):
    """Draw bounding boxes + virtual line on frame for debugging."""
    x1l, y1l, x2l, y2l = crossing.get_line_coords(frame_w, frame_h)
    cv2.line(frame, (x1l, y1l), (x2l, y2l), (0, 255, 255), 2)

    for det in detections:
        cv2.rectangle(frame, (int(det.x1), int(det.y1)), (int(det.x2), int(det.y2)), (0, 200, 0), 2)
        cv2.putText(
            frame,
            f"#{det.track_id} {det.conf:.2f}",
            (int(det.x1), int(det.y1) - 5),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 200, 0), 1
        )

    cv2.imshow("CCTV AI Count — Worker Preview", frame)


if __name__ == "__main__":
    main()
