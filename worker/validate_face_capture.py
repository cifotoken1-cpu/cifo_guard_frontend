#!/usr/bin/env python3
"""
validate_face_capture.py — Test apakah kamera C240 bisa tangkap wajah yang cukup bagus
untuk face embedding (InsightFace/ArcFace).

Cara pakai:
  1. Pasang kamera di tinggi wajah (1.8-2.2m) menghadap jalur masuk
  2. pip install insightface onnxruntime opencv-python-headless numpy
  3. python validate_face_capture.py
  4. Biarkan jalan ~2-3 menit, beberapa orang jalan lewat
  5. Tekan 'q' di preview window atau Ctrl+C untuk stop
  6. Baca laporan di terminal + cek folder capture_samples/

Metrik kunci: median interocular distance (jarak antar-mata, px)
  >= 90 px  → LAYAK, lanjut refactor
  60-89 px  → MARGINAL, dekatkan/turunkan kamera
  < 60 px   → BELUM LAYAK, perbaiki penempatan dulu
"""

import os
import sys
import time
import cv2
import numpy as np
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

RTSP_URL = os.getenv("RTSP_URL", "rtsp://admin:%40C1tr4n3t8d9--@192.168.0.60:554/stream1")
SHOW_PREVIEW = os.getenv("SHOW_PREVIEW", "true").lower() == "true"
SAMPLE_DIR = Path("capture_samples")
MAX_SAMPLES = 50
FRAME_SKIP = 3


def compute_interocular(kps):
    """Compute interocular distance from 5-point keypoints (left_eye, right_eye, ...)."""
    left_eye = kps[0]
    right_eye = kps[1]
    return np.linalg.norm(np.array(left_eye) - np.array(right_eye))


def compute_blur(face_img):
    """Laplacian variance — higher = sharper."""
    gray = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY) if len(face_img.shape) == 3 else face_img
    return cv2.Laplacian(gray, cv2.CV_64F).var()


def main():
    print("[validate] Loading InsightFace model (buffalo_l)...")
    try:
        from insightface.app import FaceAnalysis
    except ImportError:
        print("ERROR: pip install insightface onnxruntime opencv-python-headless numpy")
        sys.exit(1)

    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=0, det_size=(640, 640))
    print("[validate] Model ready")

    print(f"[validate] Connecting to {RTSP_URL}")
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|fflags;nobuffer|flags;low_delay"
    cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)

    if not cap.isOpened():
        print("ERROR: Cannot open RTSP stream")
        sys.exit(1)

    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    print(f"[validate] Stream: {w}x{h} @ {fps:.0f}fps")

    SAMPLE_DIR.mkdir(exist_ok=True)

    stats = {
        "total_frames": 0,
        "frames_with_face": 0,
        "total_faces": 0,
        "interocular_distances": [],
        "det_scores": [],
        "blur_scores": [],
        "bbox_heights": [],
        "samples_saved": 0,
    }

    frame_count = 0
    print(f"\n[validate] Running... walk past camera. Press 'q' to stop.\n")

    try:
        while True:
            grabbed = cap.grab()
            if not grabbed:
                time.sleep(0.5)
                continue

            frame_count += 1
            if frame_count % FRAME_SKIP != 0:
                continue

            ret, frame = cap.retrieve()
            if not ret or frame is None:
                continue

            stats["total_frames"] += 1
            faces = app.get(frame)

            if faces:
                stats["frames_with_face"] += 1

            for face in faces:
                stats["total_faces"] += 1

                bbox = face.bbox.astype(int)
                bw = bbox[2] - bbox[0]
                bh = bbox[3] - bbox[1]
                stats["bbox_heights"].append(bh)

                det_score = float(face.det_score)
                stats["det_scores"].append(det_score)

                kps = face.kps
                iod = compute_interocular(kps)
                stats["interocular_distances"].append(iod)

                # Crop face for blur check
                y1, y2 = max(0, bbox[1]), min(frame.shape[0], bbox[3])
                x1, x2 = max(0, bbox[0]), min(frame.shape[1], bbox[2])
                face_crop = frame[y1:y2, x1:x2]
                if face_crop.size > 0:
                    blur = compute_blur(face_crop)
                    stats["blur_scores"].append(blur)
                else:
                    blur = 0

                # Save sample
                if stats["samples_saved"] < MAX_SAMPLES and det_score > 0.5:
                    fname = SAMPLE_DIR / f"face_{stats['samples_saved']:03d}_iod{iod:.0f}_det{det_score:.2f}_blur{blur:.0f}.jpg"
                    cv2.imwrite(str(fname), face_crop)
                    stats["samples_saved"] += 1

                label = f"IOD:{iod:.0f} det:{det_score:.2f} blur:{blur:.0f}"
                verdict = "OK" if iod >= 90 else ("MARGINAL" if iod >= 60 else "LOW")
                color = (0, 255, 0) if iod >= 90 else ((0, 200, 255) if iod >= 60 else (0, 0, 255))

                if SHOW_PREVIEW:
                    cv2.rectangle(frame, (bbox[0], bbox[1]), (bbox[2], bbox[3]), color, 2)
                    cv2.putText(frame, f"{label} [{verdict}]", (bbox[0], bbox[1] - 8),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
                    for kp in kps:
                        cv2.circle(frame, (int(kp[0]), int(kp[1])), 2, (255, 255, 0), -1)

                if stats["total_faces"] % 10 == 0:
                    med_iod = np.median(stats["interocular_distances"])
                    print(f"  faces={stats['total_faces']} median_IOD={med_iod:.1f}px", end="")
                    print(f" → {'LAYAK' if med_iod >= 90 else 'MARGINAL' if med_iod >= 60 else 'BELUM LAYAK'}")

            if SHOW_PREVIEW:
                cv2.imshow("Face Capture Validation", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        if SHOW_PREVIEW:
            cv2.destroyAllWindows()

    # Report
    print("\n" + "=" * 60)
    print("  LAPORAN VALIDASI TANGKAPAN WAJAH")
    print("=" * 60)
    print(f"  Total frame diproses:     {stats['total_frames']}")
    print(f"  Frame ada wajah:          {stats['frames_with_face']} ({stats['frames_with_face'] / max(1, stats['total_frames']) * 100:.0f}%)")
    print(f"  Total deteksi wajah:      {stats['total_faces']}")
    print(f"  Sample disimpan:          {stats['samples_saved']} di {SAMPLE_DIR}/")

    if stats["interocular_distances"]:
        iods = np.array(stats["interocular_distances"])
        dets = np.array(stats["det_scores"])
        blurs = np.array(stats["blur_scores"]) if stats["blur_scores"] else np.array([0])
        bhs = np.array(stats["bbox_heights"])

        med_iod = np.median(iods)

        print(f"\n  Interocular Distance (px):")
        print(f"    Median:  {med_iod:.1f}")
        print(f"    Mean:    {np.mean(iods):.1f}")
        print(f"    Min:     {np.min(iods):.1f}")
        print(f"    Max:     {np.max(iods):.1f}")
        print(f"    >= 90:   {np.sum(iods >= 90)} ({np.sum(iods >= 90) / len(iods) * 100:.0f}%)")
        print(f"    60-89:   {np.sum((iods >= 60) & (iods < 90))} ({np.sum((iods >= 60) & (iods < 90)) / len(iods) * 100:.0f}%)")
        print(f"    < 60:    {np.sum(iods < 60)} ({np.sum(iods < 60) / len(iods) * 100:.0f}%)")

        print(f"\n  Detection Score:  median={np.median(dets):.2f}  min={np.min(dets):.2f}")
        print(f"  Blur Score:       median={np.median(blurs):.0f}  min={np.min(blurs):.0f}")
        print(f"  Face Height (px): median={np.median(bhs):.0f}  min={np.min(bhs):.0f}")

        print(f"\n  {'=' * 40}")
        if med_iod >= 90:
            print(f"  VERDICT: LAYAK (median IOD = {med_iod:.0f}px)")
            print(f"  → Lanjut refactor worker ke InsightFace")
        elif med_iod >= 60:
            print(f"  VERDICT: MARGINAL (median IOD = {med_iod:.0f}px)")
            print(f"  → Dekatkan/turunkan kamera, atau pakai lensa 4mm")
        else:
            print(f"  VERDICT: BELUM LAYAK (median IOD = {med_iod:.0f}px)")
            print(f"  → Perbaiki jarak/lensa/penempatan dulu")
        print(f"  {'=' * 40}")
    else:
        print("\n  TIDAK ADA WAJAH TERDETEKSI!")
        print("  Cek penempatan kamera — wajah harus menghadap kamera")

    print()


if __name__ == "__main__":
    main()
