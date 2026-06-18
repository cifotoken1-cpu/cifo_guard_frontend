import os
from dotenv import load_dotenv

load_dotenv()

# Camera / stream
RTSP_URL = os.getenv("RTSP_URL", "rtsp://admin:password@192.168.1.100:554/stream1")
CAMERA_ID = os.getenv("CAMERA_ID", "C240-01")

# Backend API
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3001/api")
BACKEND_TOKEN = os.getenv("BACKEND_TOKEN", "")

# Detection
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.5"))
MODEL_PATH = os.getenv("MODEL_PATH", "yolov8n.pt")

# Virtual line — pixel coordinate on frame
# LINE_AXIS: "y" = horizontal line (cross top→bottom), "x" = vertical line (cross left→right)
LINE_AXIS = os.getenv("LINE_AXIS", "y")
LINE_POSITION = int(os.getenv("LINE_POSITION", "400"))

# "standard": below→above = out, above→below = in
# "reverse":  above→below = out, below→above = in
LINE_DIRECTION_MODE = os.getenv("LINE_DIRECTION_MODE", "standard")

# Reconnect delay on RTSP failure (seconds)
RECONNECT_DELAY = int(os.getenv("RECONNECT_DELAY", "5"))

# Debug: show cv2 window (requires display, disable in headless/docker)
SHOW_PREVIEW = os.getenv("SHOW_PREVIEW", "false").lower() == "true"

# Minimum pixels object must travel past line before counting (debounce)
CROSSING_THRESHOLD_PX = int(os.getenv("CROSSING_THRESHOLD_PX", "10"))
