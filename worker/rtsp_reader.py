import cv2
import time
import logging
from config import RTSP_URL, RECONNECT_DELAY

logger = logging.getLogger(__name__)


class RTSPReader:
    """
    Robust RTSP reader with auto-reconnect.
    Usage:
        reader = RTSPReader()
        for frame in reader.frames():
            process(frame)
    """

    def __init__(self, url: str = None):
        self.url = url or RTSP_URL
        self._cap: cv2.VideoCapture | None = None

    def _connect(self) -> bool:
        if self._cap is not None:
            self._cap.release()

        logger.info(f"[rtsp] connecting to {self.url}")
        # CAP_FFMPEG gives better RTSP handling than default backend
        self._cap = cv2.VideoCapture(self.url, cv2.CAP_FFMPEG)
        self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # minimize latency

        if self._cap.isOpened():
            w = int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = self._cap.get(cv2.CAP_PROP_FPS)
            logger.info(f"[rtsp] connected — {w}x{h} @ {fps:.1f}fps")
            return True

        logger.error("[rtsp] failed to open stream")
        return False

    def frames(self):
        """Generator — yields (frame, frame_width, frame_height) indefinitely."""
        while True:
            if self._cap is None or not self._cap.isOpened():
                if not self._connect():
                    logger.warning(f"[rtsp] retrying in {RECONNECT_DELAY}s...")
                    time.sleep(RECONNECT_DELAY)
                    continue

            ret, frame = self._cap.read()
            if not ret or frame is None:
                logger.warning("[rtsp] read failed — reconnecting")
                time.sleep(RECONNECT_DELAY)
                self._connect()
                continue

            h, w = frame.shape[:2]
            yield frame, w, h

    def release(self):
        if self._cap is not None:
            self._cap.release()
            self._cap = None
