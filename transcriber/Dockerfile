FROM python:3.12-slim
WORKDIR /app
# PyAV 19 removed metadata_errors used by faster-whisper 1.2.1.
RUN pip install --no-cache-dir faster-whisper==1.2.1 av==18.1.0
COPY server.py /app/server.py
RUN useradd --system --uid 10002 --create-home clip
ENV WHISPER_MODEL=tiny.en MODEL_CACHE=/models
RUN mkdir /models && chown clip:clip /models
USER clip
EXPOSE 8090
CMD ["python", "/app/server.py"]
