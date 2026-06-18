import logging
from dataclasses import dataclass
from ultralytics import YOLO
from config import MODEL_PATH, CONFIDENCE_THRESHOLD

logger = logging.getLogger(__name__)


@dataclass
class Detection:
    track_id: int
    cx: float   # center x (pixels)
    cy: float   # center y (pixels)
    conf: float
    x1: float
    y1: float
    x2: float
    y2: float


class PersonDetector:
    """
    YOLO nano with ByteTrack — detects and tracks persons in a frame.
    Model is downloaded automatically on first run (~6MB for yolov8n.pt).
    """

    def __init__(self):
        logger.info(f"[detector] loading model: {MODEL_PATH}")
        self.model = YOLO(MODEL_PATH)
        logger.info("[detector] model ready")

    def detect(self, frame) -> tuple[list[Detection], set[int]]:
        """
        Run inference + tracking on a single frame.
        Returns:
            detections: list of Detection for this frame
            active_ids: set of track_ids seen in this frame
        """
        # persist=True keeps ByteTrack state across frames
        # classes=[0] = person only
        results = self.model.track(
            frame,
            persist=True,
            classes=[0],
            conf=CONFIDENCE_THRESHOLD,
            verbose=False,
        )

        detections = []
        active_ids = set()

        boxes = results[0].boxes
        if boxes is None or boxes.id is None:
            return detections, active_ids

        for box in boxes:
            track_id = box.id
            if track_id is None:
                continue

            tid = int(track_id.item())
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = float(box.conf[0].item())
            cx = (x1 + x2) / 2
            cy = (y1 + y2) / 2

            active_ids.add(tid)
            detections.append(Detection(
                track_id=tid,
                cx=cx, cy=cy,
                conf=conf,
                x1=x1, y1=y1, x2=x2, y2=y2,
            ))

        return detections, active_ids
