# Kokoro voice service for Rheumy (README.md). Build: docker build -t rheumy-kokoro services/kokoro-tts
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt server.py ./
RUN pip install --no-cache-dir -r requirements.txt \
 && mkdir models \
 && curl -fsSL -o models/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx \
 && curl -fsSL -o models/voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
ENV HOST=0.0.0.0 PORT=8788 KOKORO_MODELS=/app/models
EXPOSE 8788
# KOKORO_TTS_KEY must be set when the container starts.
CMD ["python", "server.py"]
