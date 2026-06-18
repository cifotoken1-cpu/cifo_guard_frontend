import logging
from config import LINE_AXIS, LINE_POSITION, LINE_DIRECTION_MODE, CROSSING_THRESHOLD_PX

logger = logging.getLogger(__name__)


class LineCrossingDetector:
    """
    Detects when a tracked object crosses a virtual line.

    LINE_AXIS="y" → horizontal line at pixel y=LINE_POSITION
        standard: top→bottom = "in", bottom→top = "out"
        reverse:  top→bottom = "out", bottom→top = "in"

    LINE_AXIS="x" → vertical line at pixel x=LINE_POSITION
        standard: left→right = "in", right→left = "out"
        reverse:  left→right = "out", right→left = "in"
    """

    def __init__(self):
        self.axis = LINE_AXIS          # "y" or "x"
        self.position = LINE_POSITION  # pixel coordinate
        self.reverse = LINE_DIRECTION_MODE == "reverse"
        self.threshold = CROSSING_THRESHOLD_PX

        # track_id → last position value (y or x center)
        self._prev: dict[int, float] = {}

    def update(self, track_id: int, cx: float, cy: float) -> str | None:
        """
        Call on each frame per tracked object.
        Returns "in", "out", or None if no crossing detected.
        """
        pos = cy if self.axis == "y" else cx
        prev = self._prev.get(track_id)
        self._prev[track_id] = pos

        if prev is None:
            return None

        line = self.position

        crossed_forward = prev < line - self.threshold and pos >= line
        crossed_backward = prev > line + self.threshold and pos <= line

        if crossed_forward:
            direction = "out" if self.reverse else "in"
            logger.info(f"[cross] track={track_id} → {direction} (pos {prev:.0f}→{pos:.0f}, line={line})")
            return direction

        if crossed_backward:
            direction = "in" if self.reverse else "out"
            logger.info(f"[cross] track={track_id} → {direction} (pos {prev:.0f}→{pos:.0f}, line={line})")
            return direction

        return None

    def remove_track(self, track_id: int):
        """Call when ByteTrack loses a track — free memory."""
        self._prev.pop(track_id, None)

    def get_line_coords(self, frame_w: int, frame_h: int):
        """Return (x1,y1,x2,y2) for drawing the virtual line on preview."""
        if self.axis == "y":
            return (0, self.position, frame_w, self.position)
        else:
            return (self.position, 0, self.position, frame_h)
