"""
Flask HTTP server — exposes POST /recognize for backend to call.
Backend grabs snapshot, POSTs image bytes here, we run InsightFace + visit tracking.
"""

import os
import time
import base64
import logging
from datetime import datetime, timezone
from flask import Flask, request, jsonify
import numpy as np
import cv2

from recognition import FaceRecognition
from api_client import post_visit_entry, close_visit, post_crossing_event, update_visit_metadata
from appearance import describe_appearance, match_exit_to_entry

logger = logging.getLogger(__name__)

app = Flask(__name__)
_recognition = FaceRecognition()
_open_visits: dict[str, dict] = {}
_person_debounce: dict[str, float] = {}

VISIT_TTL = 8 * 3600
PERSON_DEBOUNCE_SECONDS = 10

# Arah gerak → in/out. True = wajah membesar (mendekat kamera) dianggap MASUK.
# Set false kalau kamera menghadap ruangan (orang mendekat = mau keluar).
ENTRY_ON_APPROACH = os.getenv("ENTRY_ON_APPROACH", "true").lower() == "true"
# Ambang rasio area bbox awal→akhir untuk menentukan mendekat/menjauh
APPROACH_RATIO = float(os.getenv("APPROACH_RATIO", "1.15"))
RECEDE_RATIO = float(os.getenv("RECEDE_RATIO", "0.87"))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _cleanup():
    now = time.time()
    stale = [uid for uid, v in _open_visits.items() if now - v["opened_at"] > VISIT_TTL]
    for uid in stale:
        logger.info(f"[server] evicting stale visit {uid}")
        _open_visits.pop(uid)
    expired = [uid for uid, t in _person_debounce.items() if now - t > PERSON_DEBOUNCE_SECONDS * 2]
    for uid in expired:
        _person_debounce.pop(uid)


def _crop_person(frame, bbox, expand=0.5):
    """Crop person from frame using face bbox, expanded downward to capture body."""
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = bbox
    face_w = x2 - x1
    face_h = y2 - y1
    # Expand: 50% sides, 6x face height downward (head-to-knees)
    cx1 = max(0, int(x1 - face_w * expand))
    cy1 = max(0, int(y1 - face_h * 0.3))
    cx2 = min(w, int(x2 + face_w * expand))
    cy2 = min(h, int(y2 + face_h * 6))
    crop = frame[cy1:cy2, cx1:cx2]
    _, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return buf.tobytes()


def _is_debounced(uid: str) -> bool:
    now = time.time()
    if now - _person_debounce.get(uid, 0) < PERSON_DEBOUNCE_SECONDS:
        return True
    _person_debounce[uid] = now
    return False


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "gallery_size": _recognition.gallery_size})


@app.route("/recognize", methods=["POST"])
def recognize():
    t_start = time.time()

    # Accept image as raw bytes (image/jpeg) or multipart
    content_type = request.content_type or ""
    if "multipart" in content_type:
        f = request.files.get("image")
        if not f:
            return jsonify({"error": "missing image file"}), 400
        img_bytes = f.read()
    else:
        img_bytes = request.data
        if not img_bytes:
            return jsonify({"error": "empty body"}), 400

    # Decode image
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        return jsonify({"error": "cannot decode image"}), 400

    # Direction from backend: "in" (AreaEntryDetection), "out" (AreaExitDetection), or None
    direction = request.args.get("direction")

    # Run face recognition (frame already cropped by backend)
    results = _recognition.process_frame(frame)
    t_process = time.time() - t_start

    _cleanup()
    actions = []

    # Auto-detect direction for PeopleDetection (no direction from camera)
    # Face detected + not inside = IN, no new face + someone inside = OUT
    if direction is None:
        new_faces = [p for p in results if p["person_uid"] not in _open_visits]
        if new_faces:
            direction = "in"
        elif _open_visits and not results:
            direction = "out"
        elif _open_visits and results:
            # All detected faces already inside — could be exit (membelakangi, different embedding)
            direction = "out"
        else:
            direction = "in"
        logger.info(f"[server] auto-direction: {direction} (faces={len(results)}, new={len(new_faces) if direction == 'in' else 'n/a'}, open={len(_open_visits)})")

    if direction == "out":
        # === EXIT ===
        if not _open_visits:
            logger.info("[server] EXIT event but no open visits, skip")
            return jsonify({"faces": len(results), "actions": [], "process_ms": int(t_process * 1000)})

        if _is_debounced("exit_event"):
            return jsonify({"faces": len(results), "actions": [], "process_ms": int(t_process * 1000)})

        # Try face match first
        matched_uid = None
        for person in results:
            uid = person["person_uid"]
            if uid in _open_visits:
                matched_uid = uid
                break

        # Try appearance match
        if not matched_uid:
            match_result = match_exit_to_entry(img_bytes, _open_visits)
            if match_result and match_result.get("best_match_uid"):
                candidate = match_result["best_match_uid"]
                confidence = match_result.get("confidence", 0)
                if candidate in _open_visits and confidence >= 0.5:
                    matched_uid = candidate
                    logger.info(f"[server] appearance match: {matched_uid} conf={confidence:.2f}")

        # Fallback: close oldest
        if not matched_uid:
            matched_uid = min(_open_visits, key=lambda u: _open_visits[u]["opened_at"])
            logger.info(f"[server] no match, closing oldest: {matched_uid}")

        visit = _open_visits.pop(matched_uid)
        close_visit(visit_id=visit["visit_id"], exit_time=_now_iso())
        post_crossing_event(direction="out")
        actions.append({"person_uid": matched_uid, "action": "exit"})
        logger.info(f"[server] EXIT: {matched_uid} (open={len(_open_visits)})")

    elif direction == "in":
        # === ENTRY ===
        for person in results:
            uid = person["person_uid"]

            if _is_debounced(uid):
                continue

            if uid in _open_visits:
                logger.debug(f"[server] {uid} already inside, skip")
                continue

            entry_time = _now_iso()
            crop_bytes = _crop_person(frame, person["bbox"])
            appearance = describe_appearance(crop_bytes)
            appearance_text = appearance.get("appearance", "") if appearance else ""

            visit_id = post_visit_entry(person_uid=uid, entry_time=entry_time)
            if visit_id:
                _open_visits[uid] = {
                    "visit_id": visit_id,
                    "entry_time": entry_time,
                    "opened_at": time.time(),
                    "appearance": appearance_text,
                }
                if appearance_text:
                    update_visit_metadata(visit_id, {"appearance": appearance_text})
            post_crossing_event(direction="in")
            actions.append({"person_uid": uid, "action": "entry", "appearance": appearance_text})
            logger.info(f"[server] ENTRY: {uid} — {appearance_text[:60]}")

    logger.info(
        f"[server] /recognize: dir={direction} faces={len(results)} actions={len(actions)} "
        f"gallery={_recognition.gallery_size} open={len(_open_visits)}"
    )

    return jsonify({
        "faces": len(results),
        "actions": actions,
        "process_ms": int(t_process * 1000),
    })


def _motion_to_direction(motion: str, uid: str) -> str:
    """Map tren gerak (approach/recede/ambiguous) → 'in'/'out'."""
    if motion == "approach":
        return "in" if ENTRY_ON_APPROACH else "out"
    if motion == "recede":
        return "out" if ENTRY_ON_APPROACH else "in"
    # ambiguous / hanya 1 sighting → pakai status gallery (toggle)
    return "out" if uid in _open_visits else "in"


def _apply_burst_direction(direction: str, uid: str, best: dict) -> list:
    actions = []
    if direction == "in":
        if uid in _open_visits:
            return actions  # sudah di dalam
        if _is_debounced(uid):
            return actions
        entry_time = _now_iso()
        crop_bytes = _crop_person(best["frame"], best["bbox"])
        appearance = describe_appearance(crop_bytes)
        appearance_text = appearance.get("appearance", "") if appearance else ""
        visit_id = post_visit_entry(person_uid=uid, entry_time=entry_time)
        if visit_id:
            _open_visits[uid] = {
                "visit_id": visit_id, "entry_time": entry_time,
                "opened_at": time.time(), "appearance": appearance_text,
            }
            if appearance_text:
                update_visit_metadata(visit_id, {"appearance": appearance_text})
        post_crossing_event(direction="in")
        actions.append({"person_uid": uid, "action": "entry", "appearance": appearance_text})
        logger.info(f"[server] BURST ENTRY: {uid} — {appearance_text[:60]}")
    else:  # out
        if uid in _open_visits:
            visit = _open_visits.pop(uid)
            close_visit(visit_id=visit["visit_id"], exit_time=_now_iso())
            post_crossing_event(direction="out")
            actions.append({"person_uid": uid, "action": "exit"})
            logger.info(f"[server] BURST EXIT (face): {uid}")
        # wajah menjauh tapi tak ada visit terbuka utk uid ini → abaikan
    return actions


def _exit_by_appearance(jpeg_bytes: bytes) -> list:
    actions = []
    if not _open_visits:
        return actions
    matched_uid = None
    match_result = match_exit_to_entry(jpeg_bytes, _open_visits)
    if match_result and match_result.get("best_match_uid"):
        cand = match_result["best_match_uid"]
        if cand in _open_visits and match_result.get("confidence", 0) >= 0.5:
            matched_uid = cand
            logger.info(f"[server] appearance match: {cand} conf={match_result.get('confidence'):.2f}")
    if not matched_uid:
        matched_uid = min(_open_visits, key=lambda u: _open_visits[u]["opened_at"])
        logger.info(f"[server] no match, closing oldest: {matched_uid}")
    visit = _open_visits.pop(matched_uid)
    close_visit(visit_id=visit["visit_id"], exit_time=_now_iso())
    post_crossing_event(direction="out")
    actions.append({"person_uid": matched_uid, "action": "exit"})
    logger.info(f"[server] BURST EXIT (appearance): {matched_uid}")
    return actions


@app.route("/recognize_burst", methods=["POST"])
def recognize_burst():
    """Terima beberapa frame; tentukan arah dari tren ukuran wajah + pilih wajah terbaik."""
    t_start = time.time()
    data = request.get_json(silent=True) or {}
    frames = []
    for b in data.get("frames", []):
        try:
            arr = np.frombuffer(base64.b64decode(b), np.uint8)
            fr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if fr is not None:
                frames.append(fr)
        except Exception:
            continue
    if not frames:
        return jsonify({"error": "no frames"}), 400

    _cleanup()

    # Deteksi di tiap frame, kelompokkan per uid (track lintas-frame)
    tracks: dict[str, list] = {}
    for idx, fr in enumerate(frames):
        for p in _recognition.process_frame(fr):
            x1, y1, x2, y2 = p["bbox"]
            area = max(1, x2 - x1) * max(1, y2 - y1)
            tracks.setdefault(p["person_uid"], []).append(
                {"idx": idx, "area": area, "score": p["det_score"], "bbox": p["bbox"], "frame": fr}
            )

    actions = []
    motion = "none"

    if tracks:
        # Wajah dominan: paling sering muncul, lalu skor terbaik
        uid = max(tracks, key=lambda u: (len(tracks[u]), max(t["score"] for t in tracks[u])))
        seq = sorted(tracks[uid], key=lambda t: t["idx"])
        best = max(seq, key=lambda t: t["score"])
        if len(seq) >= 2:
            ratio = seq[-1]["area"] / seq[0]["area"] if seq[0]["area"] else 1.0
            motion = "approach" if ratio > APPROACH_RATIO else "recede" if ratio < RECEDE_RATIO else "ambiguous"
        else:
            motion = "single"
        direction = _motion_to_direction(motion, uid)
        actions = _apply_burst_direction(direction, uid, best)
    else:
        # Tak ada wajah sama sekali → kemungkinan keluar membelakangi → appearance match
        motion = "no_face"
        if _open_visits and not _is_debounced("exit_event"):
            mid = frames[len(frames) // 2]
            ok, buf = cv2.imencode(".jpg", mid, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ok:
                actions = _exit_by_appearance(buf.tobytes())

    logger.info(
        f"[server] /recognize_burst: frames={len(frames)} motion={motion} "
        f"actions={len(actions)} gallery={_recognition.gallery_size} open={len(_open_visits)}"
    )
    return jsonify({
        "frames": len(frames),
        "motion": motion,
        "actions": actions,
        "process_ms": int((time.time() - t_start) * 1000),
    })


def start(host: str = "0.0.0.0", port: int = 5001):
    logger.info(f"[server] loading InsightFace model...")
    _recognition.load_model()
    logger.info(f"[server] starting on {host}:{port}")
    app.run(host=host, port=port, threaded=False)
