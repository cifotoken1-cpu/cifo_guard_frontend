FROM python:3.11-slim

# OpenCV + libGL deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download YOLO model so container doesn't fetch at runtime
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# Copy source
COPY *.py ./

CMD ["python", "main.py"]
