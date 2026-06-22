import cv2
import os
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
        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|fflags;nobuffer|flags;low_delay"
        self._cap = cv2.VideoCapture(self.url, cv2.CAP_FFMPEG)
        self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)

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
        fail_count = 0
        while True:
            if self._cap is None or not self._cap.isOpened():
                if not self._connect():
                    logger.warning(f"[rtsp] retrying in {RECONNECT_DELAY}s...")
                    time.sleep(RECONNECT_DELAY)
                    continue
                fail_count = 0

            grabbed = self._cap.grab()
            if not grabbed:
                fail_count += 1
                if fail_count > 30:
                    logger.warning("[rtsp] too many grab failures — reconnecting")
                    time.sleep(RECONNECT_DELAY)
                    self._connect()
                    fail_count = 0
                continue

            ret, frame = self._cap.retrieve()
            if not ret or frame is None:
                fail_count += 1
                continue

            fail_count = 0
            h, w = frame.shape[:2]
            yield frame, w, h

    def release(self):
        if self._cap is not None:
            self._cap.release()
            self._cap = None
