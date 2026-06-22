"""
On-demand frame grabber — keeps RTSP stream open with buffer=1,
grabs latest frame when requested (not continuously processing).
"""

import os
import cv2
import time
import logging
import threading

logger = logging.getLogger(__name__)


MAX_FRAME_AGE = 5.0


class FrameGrabber:
    def __init__(self, rtsp_url: str):
        self.url = rtsp_url
        self._cap = None
        self._frame = None
        self._frame_time = 0.0
        self._lock = threading.Lock()
        self._running = False
        self._thread = None
        self._healthy = True

    def start(self):
        self._running = True
        self._thread = threading.Thread(target=self._grab_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        if self._cap:
            self._cap.release()
            self._cap = None

    def _connect(self) -> bool:
        if self._cap:
            self._cap.release()

        os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|fflags;nobuffer|flags;low_delay"
        self._cap = cv2.VideoCapture(self.url, cv2.CAP_FFMPEG)
        self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

        if self._cap.isOpened():
            w = int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            logger.info(f"[grabber] RTSP connected: {w}x{h}")
            return True

        logger.error("[grabber] failed to open RTSP")
        return False

    def _grab_loop(self):
        """Background thread: continuously grab frames, keep only latest."""
        try:
            while self._running:
                if self._cap is None or not self._cap.isOpened():
                    if not self._connect():
                        time.sleep(5)
                        continue

                grabbed = self._cap.grab()
                if not grabbed:
                    time.sleep(0.1)
                    continue

                ret, frame = self._cap.retrieve()
                if ret and frame is not None:
                    with self._lock:
                        self._frame = frame
                        self._frame_time = time.time()
        except Exception as e:
            logger.error(f"[grabber] thread crashed: {e}")
            self._healthy = False

    def get_frame(self):
        """Get latest frame (non-blocking). Returns frame or None if stale/unavailable."""
        with self._lock:
            if self._frame is None:
                return None
            age = time.time() - self._frame_time
            if age > MAX_FRAME_AGE:
                logger.warning(f"[grabber] frame stale ({age:.1f}s old), discarding")
                return None
            return self._frame.copy()

    @property
    def is_healthy(self) -> bool:
        return self._healthy and self._running

    def get_frames(self, count: int = 3, interval: float = 0.3):
        """Grab multiple frames with interval — pick best for recognition."""
        frames = []
        for _ in range(count):
            f = self.get_frame()
            if f is not None:
                frames.append(f)
            time.sleep(interval)
        return frames
