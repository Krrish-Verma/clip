"""Private CPU speech service. No remote audio upload, URL fetch, or paid API."""
import json
import os
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from faster_whisper import WhisperModel

model = None
lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(60)

    def log_message(self, *_):
        pass  # Never log speech contents or request bodies.

    def send_json(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self.send_json(200 if self.path == "/health" else 404,
                       {"status": "ready" if model else "available", "model": os.getenv("WHISPER_MODEL", "tiny.en")})

    def do_POST(self):
        global model
        if self.path != "/transcribe":
            return self.send_json(404, {"message": "Not found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self.send_json(400, {"message": "Invalid length"})
        if not 0 < length <= 32 * 1024 * 1024:
            return self.send_json(413, {"message": "Audio must be smaller than 32 MB"})
        if not lock.acquire(blocking=False):
            return self.send_json(503, {"message": "Speech service is busy. Retry shortly."})
        filename = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as source:
                filename = source.name
                remaining = length
                while remaining:
                    chunk = self.rfile.read(min(65536, remaining))
                    if not chunk:
                        raise ValueError("Incomplete upload")
                    source.write(chunk)
                    remaining -= len(chunk)
            if model is None:
                model = WhisperModel(os.getenv("WHISPER_MODEL", "tiny.en"), device="cpu",
                                     compute_type="int8", cpu_threads=2,
                                     download_root=os.getenv("MODEL_CACHE", "/models"))
            segments, info = model.transcribe(filename, beam_size=3, word_timestamps=True, vad_filter=True)
            result = [{"start": s.start, "end": s.end, "text": s.text.strip(),
                       "words": [{"start": w.start, "end": w.end, "text": w.word.strip()} for w in (s.words or [])]}
                      for s in segments]
            self.send_json(200, {"language": info.language, "segments": result,
                                 "engine": "faster-whisper", "model": os.getenv("WHISPER_MODEL", "tiny.en")})
        except Exception:
            self.send_json(500, {"message": "Speech recognition failed. The source may have no intelligible audio."})
        finally:
            if filename:
                os.unlink(filename)
            lock.release()


ThreadingHTTPServer(("0.0.0.0", 8090), Handler).serve_forever()
