"""
CCTV AI Count — Python Vision Worker

Two modes:
  event  — VIGI PeopleDetection triggers InsightFace recognition on-demand (low CPU)
  yolo   — Legacy continuous YOLO+ByteTrack loop (every frame)
"""

import logging
import signal
import sys
import time
import cv2

from config import (
    WORKER_MODE, SHOW_PREVIEW, CAMERA_ID, FRAME_SKIP,
    RTSP_URL, VIGI_HOST, VIGI_PORT, VIGI_USER, VIGI_PASS,
    EVENT_DEBOUNCE_SECONDS, EVENT_GRAB_COUNT, EVENT_GRAB_INTERVAL,
    WORKER_SERVER_HOST, WORKER_SERVER_PORT,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("main")

_running = True

def _handle_signal(sig, _frame):
    global _running
    logger.info(f"[main] received signal {sig}, shutting down...")
    _running = False

signal.signal(signal.SIGTERM, _handle_signal)
signal.signal(signal.SIGINT, _handle_signal)


def wait_for_backend(retries: int = 10, delay: int = 3):
    from api_client import health_check
    for i in range(retries):
        if health_check():
            logger.info("[main] backend reachable")
            return True
        logger.warning(f"[main] backend not ready, retry {i+1}/{retries}...")
        time.sleep(delay)
    logger.error("[main] backend unreachable after retries — exiting")
    return False


# ── EVENT-DRIVEN MODE ───────────────────────────────────────────────────────

def main_event():
    from vigi_client import VigiClient
    from event_subscriber import EventSubscriber
    from frame_grabber import FrameGrabber
    from recognition import FaceRecognition
    from api_client import post_visit_entry, close_visit, post_crossing_event

    logger.info(f"[main] EVENT mode — camera={CAMERA_ID}")

    if not wait_for_backend():
        sys.exit(1)

    client = VigiClient(
        host=VIGI_HOST, port=VIGI_PORT,
        username=VIGI_USER, password=VIGI_PASS,
    )
    client.login()
    client.enable_people_detection()

    grabber = FrameGrabber(RTSP_URL)
    grabber.start()
    logger.info("[main] frame grabber started")

    recognition = FaceRecognition()
    recognition.load_model()

    subscriber = EventSubscriber(client, events=["PeopleDetection"])

    VISIT_TTL = 8 * 3600

    # visit tracking: person_uid → {"visit_id", "entry_time", "opened_at"}
    open_visits: dict[str, dict] = {}
    # per-person debounce: person_uid → last action timestamp
    person_debounce: dict[str, float] = {}
    PERSON_DEBOUNCE_SECONDS = 10
    last_event_time = 0
    event_count = 0
    no_face_count = 0

    def _now_iso():
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    def _cleanup_stale_visits():
        now = time.time()
        stale = [uid for uid, v in open_visits.items() if now - v["opened_at"] > VISIT_TTL]
        for uid in stale:
            logger.info(f"[main] evicting stale visit {uid} (TTL expired)")
            open_visits.pop(uid)

    def _is_person_debounced(uid: str) -> bool:
        now = time.time()
        last = person_debounce.get(uid, 0)
        if now - last < PERSON_DEBOUNCE_SECONDS:
            return True
        person_debounce[uid] = now
        return False

    MIN_PROCESS_INTERVAL = 3.0
    API_FAIL_THRESHOLD = 5
    api_fail_count = 0
    last_process_done = 0

    try:
        for event in subscriber.subscribe():
            if not _running:
                break

            now = time.time()
            if now - last_event_time < 1.0:
                logger.debug("[main] global debounce — skipping event")
                continue

            # H1: rate limiter — don't start new processing until MIN_PROCESS_INTERVAL after last finished
            if now - last_process_done < MIN_PROCESS_INTERVAL:
                logger.debug(f"[main] rate limit — {MIN_PROCESS_INTERVAL - (now - last_process_done):.1f}s cooldown")
                continue

            last_event_time = now
            event_count += 1

            t_start = time.time()
            logger.info(f"[main] event #{event_count}: {event.get('event_type')}")

            frames = grabber.get_frames(count=EVENT_GRAB_COUNT, interval=EVENT_GRAB_INTERVAL)
            if not frames:
                logger.warning("[main] no frames available")
                last_process_done = time.time()
                continue

            best_results = []
            best_frame = None
            for frame in frames:
                results = recognition.process_frame(frame)
                if len(results) > len(best_results):
                    best_results = results
                    best_frame = frame

            t_process = time.time() - t_start
            last_process_done = time.time()

            if not best_results:
                no_face_count += 1
                logger.info(
                    f"[main] no faces detected (total no-face: {no_face_count}) "
                    f"— processing took {t_process:.2f}s"
                )
                continue

            _cleanup_stale_visits()

            for person in best_results:
                uid = person["person_uid"]

                if _is_person_debounced(uid):
                    logger.debug(f"[main] person {uid} debounced — skip")
                    continue

                if person["is_new"]:
                    entry_time = _now_iso()
                    visit_id = post_visit_entry(
                        person_uid=uid,
                        entry_time=entry_time,
                    )
                    if visit_id:
                        open_visits[uid] = {
                            "visit_id": visit_id,
                            "entry_time": entry_time,
                            "opened_at": time.time(),
                        }
                        api_fail_count = 0
                    else:
                        api_fail_count += 1
                    post_crossing_event(direction="in")
                    logger.info(f"[main] new person {uid} — entry recorded")
                else:
                    if uid in open_visits:
                        visit = open_visits.pop(uid)
                        ok = close_visit(
                            visit_id=visit["visit_id"],
                            exit_time=_now_iso(),
                        )
                        if ok:
                            api_fail_count = 0
                        else:
                            api_fail_count += 1
                        post_crossing_event(direction="out")
                        logger.info(f"[main] known person {uid} — exit recorded")
                    else:
                        logger.debug(f"[main] known person {uid} — still inside")

            # H2: loud warning on consecutive API failures
            if api_fail_count >= API_FAIL_THRESHOLD:
                logger.error(
                    f"[main] WARNING: {api_fail_count} consecutive API failures! "
                    "Backend may be down or JWT expired. Check BACKEND_TOKEN."
                )

            if SHOW_PREVIEW and best_results:
                _draw_event_preview(best_frame, best_results)

            logger.info(
                f"[main] events={event_count} "
                f"gallery={recognition.gallery_size} "
                f"open_visits={len(open_visits)} "
                f"process_time={t_process:.2f}s"
            )

    finally:
        subscriber.stop()
        grabber.stop()
        if SHOW_PREVIEW:
            cv2.destroyAllWindows()
        logger.info(f"[main] stopped. total events: {event_count}")


def _draw_event_preview(frame, results):
    for person in results:
        bbox = person["bbox"]
        color = (0, 255, 0) if person["is_new"] else (255, 200, 0)
        label = f"{person['person_uid']} {'NEW' if person['is_new'] else 'KNOWN'}"
        cv2.rectangle(frame, (bbox[0], bbox[1]), (bbox[2], bbox[3]), color, 2)
        cv2.putText(frame, label, (bbox[0], bbox[1] - 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
    cv2.imshow("CCTV AI Count — Event Mode", frame)
    cv2.waitKey(1)


# ── YOLO MODE (LEGACY) ─────────────────────────────────────────────────────

def main_yolo():
    from rtsp_reader import RTSPReader
    from detector import PersonDetector
    from line_crossing import LineCrossingDetector
    from visit_tracker import VisitTracker
    from api_client import post_crossing_event, health_check

    logger.info(f"[main] YOLO mode — camera={CAMERA_ID}")

    if not wait_for_backend():
        sys.exit(1)

    reader = RTSPReader()
    detector = PersonDetector()
    crossing = LineCrossingDetector()
    visits = VisitTracker()
    prev_active_ids: set[int] = set()
    frame_count = 0
    log_interval = 300

    try:
        for frame, frame_w, frame_h in reader.frames():
            if not _running:
                break

            frame_count += 1

            if frame_count == 1:
                logger.info(f"[main] first frame received: {frame_w}x{frame_h}")

            if frame_count % FRAME_SKIP != 0:
                continue

            detections, active_ids = detector.detect(frame)
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

            if frame_count % log_interval == 0:
                logger.info(
                    f"[main] frames={frame_count} "
                    f"tracked={len(active_ids)} "
                    f"open_visits={visits.open_count}"
                )

            if SHOW_PREVIEW:
                _draw_yolo_preview(frame, frame_w, frame_h, detections, crossing)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
    finally:
        reader.release()
        if SHOW_PREVIEW:
            cv2.destroyAllWindows()
        logger.info(f"[main] stopped. total frames: {frame_count}")


def _draw_yolo_preview(frame, frame_w, frame_h, detections, crossing):
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
    cv2.imshow("CCTV AI Count — YOLO Mode", frame)


# ── ENTRY ───────────────────────────────────────────────────────────────────

MAX_RESTARTS = 10
RESTART_COOLDOWN = 15


def main_server():
    from server import start as server_start
    logger.info(f"[main] SERVER mode — listening on {WORKER_SERVER_HOST}:{WORKER_SERVER_PORT}")
    if not wait_for_backend():
        sys.exit(1)
    server_start(host=WORKER_SERVER_HOST, port=WORKER_SERVER_PORT)


def main():
    run_fn = None
    if WORKER_MODE == "server":
        run_fn = main_server
    elif WORKER_MODE == "event":
        run_fn = main_event
    elif WORKER_MODE == "yolo":
        run_fn = main_yolo
    else:
        logger.error(f"[main] unknown WORKER_MODE={WORKER_MODE}, use 'server', 'event', or 'yolo'")
        sys.exit(1)

    restarts = 0
    while _running and restarts < MAX_RESTARTS:
        try:
            run_fn()
            break
        except KeyboardInterrupt:
            break
        except Exception as e:
            restarts += 1
            logger.error(
                f"[main] CRASHED ({restarts}/{MAX_RESTARTS}): {e} "
                f"— restarting in {RESTART_COOLDOWN}s"
            )
            if restarts >= MAX_RESTARTS:
                logger.error("[main] max restarts reached — giving up")
                sys.exit(1)
            time.sleep(RESTART_COOLDOWN)

    logger.info("[main] worker exited")


if __name__ == "__main__":
    main()
