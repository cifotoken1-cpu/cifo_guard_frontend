import os
from dotenv import load_dotenv

load_dotenv()

# ── Worker mode ─────────────────────────────────────────────────────────────
# "event" = event-driven (VIGI PeopleDetection → InsightFace on-demand)
# "yolo"  = legacy continuous loop (YOLO+ByteTrack every frame)
# "server" = Flask HTTP server, backend POSTs snapshots here (recommended)
# "event"  = VIGI PeopleDetection event-driven (requires direct camera access)
# "yolo"   = legacy continuous YOLO+ByteTrack loop
WORKER_MODE = os.getenv("WORKER_MODE", "server")

# Camera / stream
RTSP_URL = os.getenv("RTSP_URL", "rtsp://admin:password@192.168.1.100:554/stream1")
CAMERA_ID = os.getenv("CAMERA_ID", "C240-01")

# VIGI OpenAPI (for event-driven mode)
VIGI_HOST = os.getenv("VIGI_HOST", "192.168.0.60")
VIGI_PORT = int(os.getenv("VIGI_PORT", "20443"))
VIGI_USER = os.getenv("VIGI_USER", "admin")
VIGI_PASS = os.getenv("VIGI_PASS", "")

# Event debounce — ignore duplicate events within N seconds
EVENT_DEBOUNCE_SECONDS = int(os.getenv("EVENT_DEBOUNCE_SECONDS", "5"))

# How many frames to grab per event for best face selection
EVENT_GRAB_COUNT = int(os.getenv("EVENT_GRAB_COUNT", "3"))
EVENT_GRAB_INTERVAL = float(os.getenv("EVENT_GRAB_INTERVAL", "0.3"))

# Backend API
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3001/api")
BACKEND_TOKEN = os.getenv("BACKEND_TOKEN", "")

# Detection (YOLO mode only)
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.5"))
MODEL_PATH = os.getenv("MODEL_PATH", "yolov8n.pt")

# Virtual line (YOLO mode only)
LINE_AXIS = os.getenv("LINE_AXIS", "y")
LINE_POSITION = int(os.getenv("LINE_POSITION", "400"))
LINE_DIRECTION_MODE = os.getenv("LINE_DIRECTION_MODE", "standard")

# Reconnect delay on RTSP failure (seconds)
RECONNECT_DELAY = int(os.getenv("RECONNECT_DELAY", "5"))

# Frame skip (YOLO mode only)
FRAME_SKIP = int(os.getenv("FRAME_SKIP", "3"))

# Flask server (server mode)
WORKER_SERVER_HOST = os.getenv("WORKER_SERVER_HOST", "0.0.0.0")
WORKER_SERVER_PORT = int(os.getenv("WORKER_SERVER_PORT", "5001"))

# ROI for face detection — crop frame to door area before InsightFace
# Format: x1,y1,x2,y2 as percentage (0-100) of frame dimensions
# Example: "0,0,50,100" = left half of frame (door on left side)
ROI = os.getenv("RECOGNITION_ROI", "")

# Debug: show cv2 window
SHOW_PREVIEW = os.getenv("SHOW_PREVIEW", "false").lower() == "true"

# Minimum pixels object must travel past line before counting (YOLO mode)
CROSSING_THRESHOLD_PX = int(os.getenv("CROSSING_THRESHOLD_PX", "10"))
