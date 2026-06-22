"""
Face recognition module — InsightFace on-demand.
Called only when PeopleDetection event arrives (not every frame).
Manages in-memory embedding gallery for anonymous visit tracking.
"""

import time
import logging
import numpy as np

logger = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.35
GALLERY_TTL_SECONDS = 8 * 3600


class FaceRecognition:
    def __init__(self):
        self._app = None
        self._gallery: dict[str, dict] = {}
        self._next_uid = 0

    def load_model(self):
        from insightface.app import FaceAnalysis
        logger.info("[recognition] loading InsightFace buffalo_l...")
        self._app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
        self._app.prepare(ctx_id=0, det_size=(640, 640))
        logger.info("[recognition] model ready")

    def process_frame(self, frame) -> list[dict]:
        """
        Detect faces in frame, match against gallery.
        Returns list of {'person_uid', 'is_new', 'det_score', 'bbox'}.
        """
        if self._app is None:
            self.load_model()

        faces = self._app.get(frame)
        if not faces:
            return []

        self._cleanup_gallery()
        results = []

        for face in faces:
            embedding = face.normed_embedding
            det_score = float(face.det_score)
            bbox = face.bbox.astype(int).tolist()

            if det_score < 0.5:
                continue

            match_uid = self._match_gallery(embedding)

            if match_uid:
                self._gallery[match_uid]["last_seen"] = time.time()
                self._gallery[match_uid]["embedding"] = embedding
                results.append({
                    "person_uid": match_uid,
                    "is_new": False,
                    "det_score": det_score,
                    "bbox": bbox,
                })
            else:
                uid = self._new_uid()
                self._gallery[uid] = {
                    "embedding": embedding,
                    "first_seen": time.time(),
                    "last_seen": time.time(),
                }
                results.append({
                    "person_uid": uid,
                    "is_new": True,
                    "det_score": det_score,
                    "bbox": bbox,
                })

        return results

    def _match_gallery(self, embedding) -> str | None:
        best_uid = None
        best_sim = -1

        for uid, entry in self._gallery.items():
            sim = np.dot(embedding, entry["embedding"])
            if sim > SIMILARITY_THRESHOLD and sim > best_sim:
                best_sim = sim
                best_uid = uid

        if best_uid:
            logger.info(f"[recognition] matched {best_uid} sim={best_sim:.3f}")
        elif best_sim > 0:
            logger.info(f"[recognition] no match, best sim={best_sim:.3f} (threshold={SIMILARITY_THRESHOLD})")

        return best_uid

    def _new_uid(self) -> str:
        self._next_uid += 1
        return f"face-{self._next_uid:04d}"

    def _cleanup_gallery(self):
        now = time.time()
        expired = [
            uid for uid, entry in self._gallery.items()
            if now - entry["last_seen"] > GALLERY_TTL_SECONDS
        ]
        for uid in expired:
            logger.info(f"[recognition] gallery evict {uid} (TTL expired)")
            del self._gallery[uid]

    @property
    def gallery_size(self) -> int:
        return len(self._gallery)
