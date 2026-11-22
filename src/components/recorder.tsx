"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Download,
  LoaderCircle,
  Mic,
  MicOff,
  Monitor,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Square,
  Trash2,
  Upload,
  Video,
  Camera,
  Pencil,
  Eraser,
  ScanEye,
  Save,
  ImageDown,
  MousePointer2,
} from "lucide-react";
import { api, ApiError, cloudConfigured, uploadMedia } from "@/lib/api";
import { duration, errorMessage } from "@/lib/types";
import { useSession } from "./session-provider";
import { ErrorNotice } from "./ui";
import { Dialog } from "./dialog";
import {
  createCapture,
  downloadBlob,
  type Capture,
  type Point,
} from "@/lib/capture";
import { saveDraft, readDraft, deleteDraft, type Draft } from "@/lib/drafts";

type Phase = "idle" | "choosing" | "recording" | "paused" | "preview";
const MAX_BYTES = 200 * 1024 * 1024;
const MAX_SECONDS = 600;

export function Recorder({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { user,organizationId } = useSession();
  const [phase, setPhase] = useState<Phase>("idle");
  const [limits, setLimits] = useState({
    maxVideos: 5,
    maxVideoBytes: MAX_BYTES,
    maxDurationSeconds: MAX_SECONDS,
  });
  const [mode, setMode] = useState<"screen" | "camera" | "both">("screen");
  const [quality, setQuality] = useState(1080);
  const [microphoneId, setMicrophoneId] = useState("");
  const [cameraId, setCameraId] = useState("");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [countdown, setCountdown] = useState(0);
  const [tool, setTool] = useState<"pointer" | "draw" | "blur" | "camera">(
    "pointer",
  );
  const [notes, setNotes] = useState("");
  const [recovered, setRecovered] = useState<{
    draft: Draft;
    blob: Blob;
  } | null>(null);
  const captureRef = useRef<Capture | null>(null);
  const draftRef = useRef<Draft | null>(null);
  const draftWrite = useRef<Promise<void>>(Promise.resolve());
  const elapsedRef = useRef(0);
  const drawing = useRef<Point | null>(null);
  const draftOwner = user ? `${user.id}:${organizationId||"personal"}` : "device-guest";
  const [microphone, setMicrophone] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [leaveUrl, setLeaveUrl] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const streams = useRef<MediaStream[]>([]);
  const liveVideo = useRef<HTMLVideoElement>(null);
  const liveStream = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef("");
  const mounted = useRef(true);
  const uploadedVideo = useRef<{
    videoId: string;
    uploadUrl: string;
    sent: boolean;
    refreshUrl?: boolean;
  } | null>(null);

  const releaseDevices = useCallback(() => {
    captureRef.current?.stop();
    captureRef.current = null;
    streams.current.forEach((stream) =>
      stream.getTracks().forEach((track) => track.stop()),
    );
    streams.current = [];
    liveStream.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    void readDraft(draftOwner)
      .then((value) => {
        if (active && value?.blob.size) setRecovered(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [draftOwner]);
  useEffect(() => {
    elapsedRef.current = seconds;
  }, [seconds]);
  useEffect(() => {
    if (cloudConfigured)
      void api<typeof limits>("/api/config")
        .then(setLimits)
        .catch(() => {});
  }, []);
  async function enumerateDevices() {
    try {
      const permission = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode !== "screen",
      });
      permission.getTracks().forEach((track) => track.stop());
      setDevices(await navigator.mediaDevices.enumerateDevices());
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const stop = useCallback(() => {
    if (recorder.current && recorder.current.state !== "inactive")
      recorder.current.stop();
    releaseDevices();
  }, [releaseDevices]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current?.state !== "inactive") recorder.current?.stop();
      releaseDevices();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [releaseDevices]);
  useEffect(() => {
    if (liveVideo.current && liveStream.current)
      liveVideo.current.srcObject = liveStream.current;
  }, [phase]);
  useEffect(() => {
    if (phase !== "recording") return;
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      setSeconds((value) => value + (now - previous) / 1000);
      previous = now;
    }, 250);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => {
    if (seconds >= limits.maxDurationSeconds && phase === "recording") stop();
  }, [seconds, phase, stop, limits.maxDurationSeconds]);
  useEffect(() => {
    if (!(recording || phase === "recording" || phase === "paused")) return;
    const preventLoss = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const confirmNavigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const url = new URL(link.href, window.location.href);
      if (
        url.origin !== window.location.origin ||
        url.pathname === window.location.pathname
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveUrl(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", preventLoss);
    document.addEventListener("click", confirmNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", preventLoss);
      document.removeEventListener("click", confirmNavigation, true);
    };
  }, [recording, phase]);

  async function start() {
    setError("");
    if (
      !navigator.mediaDevices?.getUserMedia ||
      (mode !== "camera" && !navigator.mediaDevices?.getDisplayMedia) ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Screen recording isn’t supported in this browser. Open Clip in a desktop browser such as Chrome or Edge.",
      );
      return;
    }
    setPhase("choosing");
    try {
      const capture = await createCapture({
        mode,
        microphone,
        microphoneId,
        cameraId,
        height: quality,
      });
      captureRef.current = capture;
      if (!mounted.current) {
        capture.stop();
        return;
      }
      const combined = capture.stream;
      streams.current = capture.sources;
      for (const source of capture.sources)
        source.getVideoTracks().forEach((track) => {
          track.onended = stop;
        });
      await deleteDraft(draftOwner).catch(() => {});
      const mimeType = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const media = new MediaRecorder(combined, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond:
          quality >= 2160 ? 8_000_000 : quality >= 1080 ? 4_000_000 : 1_800_000,
        audioBitsPerSecond: 96_000,
      });
      recorder.current = media;
      const chunks: Blob[] = [];
      draftRef.current = {
        id: crypto.randomUUID(),
        owner: draftOwner,
        mime: media.mimeType || "video/webm",
        title,
        seconds: 0,
        savedAt: Date.now(),
      };
      let bytes = 0;
      let failed = false;
      media.ondataavailable = (event) => {
        if (!event.data.size) return;
        chunks.push(event.data);
        const chunkIndex = chunks.length - 1;
        if (draftRef.current) {
          const draft = {
            ...draftRef.current,
            seconds: elapsedRef.current,
            savedAt: Date.now(),
          };
          draftWrite.current = draftWrite.current
            .then(() => saveDraft(draft, event.data, chunkIndex))
            .catch(() => {
              if (mounted.current)
                setError(
                  "Local draft storage is full or unavailable. Keep this tab open and download your recording.",
                );
            });
        }
        bytes += event.data.size;
        if (bytes >= limits.maxVideoBytes && media.state !== "inactive") {
          stop();
        }
      };
      media.onerror = () => {
        failed = true;
        stop();
        if (mounted.current) {
          setError("The recording was interrupted. Please try again.");
          setPhase("idle");
        }
      };
      media.onstop = async () => {
        releaseDevices();
        await draftWrite.current;
        if (!mounted.current || failed) return;
        const blob = new Blob(chunks, { type: media.mimeType || "video/webm" });
        if (!blob.size) {
          setError("No video was captured. Please try again.");
          setPhase("idle");
          return;
        }
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = URL.createObjectURL(blob);
        setPreviewUrl(previewUrlRef.current);
        setRecording(blob);
        setPhase("preview");
        if (blob.size > limits.maxVideoBytes)
          setError(
            `This recording exceeds the ${Math.round(limits.maxVideoBytes / 1024 / 1024)} MB upload limit. Download it or record a shorter clip.`,
          );
      };
      liveStream.current = combined;
      setRecording(null);
      uploadedVideo.current = null;
      setSeconds(0);
      for (let count = 3; count > 0; count--) {
        setCountdown(count);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (!mounted.current || !combined.active) {
          releaseDevices();
          setPhase("idle");
          setCountdown(0);
          return;
        }
      }
      setCountdown(0);
      media.start(1000);
      setPhase("recording");
    } catch (error) {
      releaseDevices();
      if (!mounted.current) return;
      setPhase("idle");
      setCountdown(0);
      setError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Screen or microphone access wasn’t granted. Try again and select a screen to share, or turn off your microphone."
          : "Couldn’t start recording. Check your screen and microphone permissions, then try again.",
      );
    }
  }

  function togglePause() {
    if (recorder.current?.state === "recording") {
      recorder.current.pause();
      setPhase("paused");
    } else if (recorder.current?.state === "paused") {
      recorder.current.resume();
      setPhase("recording");
    }
  }

  function discard() {
    void draftWrite.current.then(() => deleteDraft(draftOwner)).catch(() => {});
    draftRef.current = null;
    setRecovered(null);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setPreviewUrl("");
    setRecording(null);
    setPhase("idle");
    setSeconds(0);
    setError("");
    uploadedVideo.current = null;
  }

  async function upload() {
    if (!recording || !title.trim() || uploading) return;
    if (recording.size > limits.maxVideoBytes) {
      setError(
        `Your recording must be smaller than ${Math.round(limits.maxVideoBytes / 1024 / 1024)} MB.`,
      );
      return;
    }
    setUploading(true);
    setError("");
    setProgress(0);
    try {
      if (!uploadedVideo.current) {
        const created = await api<{ videoId: string; uploadUrl: string }>(
          "/api/videos",
          {
            method: "POST",
            body: JSON.stringify({
              title: title.trim(),
              mimeType: recording.type,
              sizeBytes: recording.size,
            }),
          },
        );
        uploadedVideo.current = { ...created, sent: false };
        if (draftRef.current) {
          draftRef.current = {
            ...draftRef.current,
            videoId: created.videoId,
            title,
            seconds,
          };
          await saveDraft(draftRef.current).catch(() => {});
        }
      }
      const current = uploadedVideo.current;
      if (!current.sent) {
        const session = await api<{
          partSize: number;
          parts: { number: number; url: string | null; uploaded: boolean }[];
        }>(`/api/videos/${current.videoId}/multipart`, { method: "POST" });
        let sentBytes = session.parts
          .filter((p) => p.uploaded)
          .reduce(
            (sum, p) =>
              sum +
              Math.min(
                session.partSize,
                recording.size - (p.number - 1) * session.partSize,
              ),
            0,
          );
        setProgress(Math.round((sentBytes / recording.size) * 100));
        for (const part of session.parts) {
          if (part.uploaded) continue;
          const chunk = recording.slice(
            (part.number - 1) * session.partSize,
            Math.min(part.number * session.partSize, recording.size),
            recording.type,
          );
          const before = sentBytes;
          await uploadMedia(part.url!, chunk, (value) =>
            setProgress(
              Math.round(
                ((before + (chunk.size * value) / 100) / recording.size) * 100,
              ),
            ),
          );
          sentBytes += chunk.size;
        }
        await api(`/api/videos/${current.videoId}/multipart/complete`, {
          method: "POST",
        });
        current.sent = true;
      }
      await api(`/api/videos/${current.videoId}/complete`, { method: "POST" });
      await deleteDraft(draftOwner).catch(() => {});
      draftRef.current = null;
      setRecording(null);
      router.push(`/videos/${current.videoId}`);
    } catch (error) {
      const current = uploadedVideo.current;
      if (
        current &&
        (!current.sent ||
          (error instanceof ApiError && [400, 409].includes(error.status)))
      ) {
        current.sent = false;
        current.refreshUrl = true;
      }
      setError(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  const active = phase === "recording" || phase === "paused";
  function point(event: React.PointerEvent): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    const video = liveVideo.current;
    const aspect =
      video?.videoWidth && video.videoHeight
        ? video.videoWidth / video.videoHeight
        : rect.width / rect.height;
    const width = Math.min(rect.width, rect.height * aspect),
      height = width / aspect;
    return {
      x: Math.max(
        0,
        Math.min(
          1,
          (event.clientX - rect.left - (rect.width - width) / 2) / width,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          1,
          (event.clientY - rect.top - (rect.height - height) / 2) / height,
        ),
      ),
    };
  }
  return (
    <div className={`recorder ${compact ? "recorder-compact" : ""}`}>
      {recovered && phase === "idle" && (
        <div className="draft-recovery">
          <Save size={19} />
          <div>
            <strong>Your last recording is still here.</strong>
            <p>
              Saved locally {new Date(recovered.draft.savedAt).toLocaleString()}{" "}
              · {(recovered.blob.size / 1024 / 1024).toFixed(1)} MB
            </p>
          </div>
          <button
            className="button button-outline"
            onClick={() => {
              const saved = recovered;
              previewUrlRef.current = URL.createObjectURL(saved.blob);
              setPreviewUrl(previewUrlRef.current);
              setRecording(saved.blob);
              setTitle(saved.draft.title);
              setSeconds(saved.draft.seconds);
              draftRef.current = saved.draft;
              if (saved.draft.videoId)
                uploadedVideo.current = {
                  videoId: saved.draft.videoId,
                  uploadUrl: "",
                  sent: false,
                  refreshUrl: true,
                };
              setRecovered(null);
              setPhase("preview");
            }}
          >
            Restore
          </button>
          <button
            className="icon-button"
            aria-label="Discard saved draft"
            onClick={discard}
          >
            <Trash2 size={17} />
          </button>
        </div>
      )}
      {phase === "idle" && !compact && (
        <div className="capture-settings">
          <label>
            Record
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="screen">Screen only</option>
              <option value="both">Screen + camera</option>
              <option value="camera">Camera only</option>
            </select>
          </label>
          <label>
            Quality
            <select
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
            >
              <option value={720}>720p · smaller files</option>
              <option value={1080}>1080p · recommended</option>
              <option value={2160}>4K · larger files</option>
            </select>
          </label>
          <button
            className="button button-outline"
            onClick={() => void enumerateDevices()}
          >
            <Camera size={16} /> Choose devices
          </button>
          {devices.length > 0 && (
            <>
              <label>
                Microphone
                <select
                  value={microphoneId}
                  onChange={(e) => setMicrophoneId(e.target.value)}
                >
                  <option value="">System default</option>
                  {devices
                    .filter((d) => d.kind === "audioinput")
                    .map((d) => (
                      <option value={d.deviceId} key={d.deviceId}>
                        {d.label}
                      </option>
                    ))}
                </select>
              </label>
              {mode !== "screen" && (
                <label>
                  Camera
                  <select
                    value={cameraId}
                    onChange={(e) => setCameraId(e.target.value)}
                  >
                    <option value="">System default</option>
                    {devices
                      .filter((d) => d.kind === "videoinput")
                      .map((d) => (
                        <option value={d.deviceId} key={d.deviceId}>
                          {d.label}
                        </option>
                      ))}
                  </select>
                </label>
              )}
            </>
          )}
        </div>
      )}
      {leaveUrl && (
        <Dialog
          title="Keep your clip before you go."
          onClose={() => setLeaveUrl(null)}
        >
          <p>
            Your recording is still on this page. Leaving now will discard it.
            Stay here to finish, download, or upload your clip.
          </p>
          <div className="dialog-actions">
            <button
              className="button button-ghost"
              onClick={() => {
                stop();
                router.push(leaveUrl);
              }}
            >
              Discard and leave
            </button>
            <button
              className="button button-dark"
              autoFocus
              onClick={() => setLeaveUrl(null)}
            >
              Stay here
            </button>
          </div>
        </Dialog>
      )}
      <div className="recorder-topline">
        <span>
          <Video size={17} />{" "}
          {phase === "preview" ? "Your recording" : "Screen recorder"}
        </span>
        <span
          className={`recorder-state ${phase === "recording" ? "is-live" : ""}`}
        >
          <span />
          {phase === "recording"
            ? "Recording"
            : phase === "paused"
              ? "Paused"
              : phase === "preview"
                ? "Ready to review"
                : "Ready to record"}
        </span>
      </div>
      <div
        className={`recording-canvas ${active || previewUrl ? "has-video" : ""}`}
      >
        {active ? (
          <>
            <video
              ref={liveVideo}
              autoPlay
              muted
              playsInline
              aria-label="Live screen preview"
            />
            <div
              className="capture-annotation-layer"
              aria-label="Annotate the live preview"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                drawing.current = point(event);
                const capture = captureRef.current;
                if (capture && tool === "draw")
                  capture.paths.push([drawing.current]);
              }}
              onPointerMove={(event) => {
                const capture = captureRef.current;
                if (!capture) return;
                const p = point(event);
                capture.pointer = tool === "pointer" ? p : null;
                if (!drawing.current) return;
                if (tool === "draw") capture.paths.at(-1)?.push(p);
                if (tool === "camera")
                  capture.bubble = {
                    x: Math.max(0.15, Math.min(0.85, p.x)),
                    y: Math.max(0.15, Math.min(0.85, p.y)),
                  };
              }}
              onPointerUp={(event) => {
                const capture = captureRef.current;
                if (capture && drawing.current && tool === "blur") {
                  const end = point(event),
                    start = drawing.current;
                  capture.blurs.push({
                    x: Math.min(start.x, end.x),
                    y: Math.min(start.y, end.y),
                    width: Math.abs(end.x - start.x),
                    height: Math.abs(end.y - start.y),
                  });
                }
                drawing.current = null;
              }}
              onPointerLeave={() => {
                if (captureRef.current) captureRef.current.pointer = null;
              }}
            />
            {phase === "paused" && (
              <div className="paused-overlay">
                <Pause size={24} /> Recording paused
              </div>
            )}
          </>
        ) : previewUrl ? (
          <video
            src={previewUrl}
            controls
            playsInline
            aria-label="Recording preview"
          />
        ) : (
          <div className="recorder-welcome">
            <div className="monitor-symbol">
              <Monitor size={36} strokeWidth={1.5} />
              <span>
                <Mic size={15} />
              </span>
            </div>
            <h2>A little show. A little tell.</h2>
            <p>
              Your screen and your voice.
              <br />
              That’s all you need to get the point across.
            </p>
            <button
              className="button button-dark"
              onClick={start}
              disabled={phase === "choosing" || !!recovered}
            >
              {phase === "choosing" ? (
                <>
                  <LoaderCircle className="spin" size={17} /> Choose your
                  screen… {countdown > 0 ? countdown : ""}
                </>
              ) : (
                <>
                  <span className="record-dot" /> Start recording
                </>
              )}
            </button>
            <span className="recorder-permission">
              You choose what to share.
            </span>
          </div>
        )}
      </div>
      {active ? (
        <div
          className="capture-live-tools"
          role="toolbar"
          aria-label="Recording tools"
        >
          {[
            { id: "pointer", label: "Highlight", icon: MousePointer2 },
            { id: "draw", label: "Draw", icon: Pencil },
            { id: "blur", label: "Blur region", icon: ScanEye },
            ...(mode === "both"
              ? [{ id: "camera", label: "Move camera", icon: Camera }]
              : []),
          ].map((item) => (
            <button
              key={item.id}
              aria-pressed={tool === item.id}
              onClick={() => setTool(item.id as typeof tool)}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
          <button
            onClick={() => {
              if (captureRef.current) {
                captureRef.current.paths = [];
                captureRef.current.blurs = [];
              }
            }}
          >
            <Eraser size={16} /> Clear
          </button>
          <button
            onClick={() =>
              void captureRef.current
                ?.screenshot()
                .then((blob) => downloadBlob(blob, "clip-screenshot.png"))
                .catch((e) => setError(errorMessage(e)))
            }
          >
            <ImageDown size={16} /> Screenshot
          </button>
          <small>Draw, highlight, and blur directly on this preview.</small>
        </div>
      ) : null}
      {active ? (
        <div className="recording-controls">
          <span className="timer">
            <span
              className={
                phase === "recording"
                  ? "record-dot pulse"
                  : "record-dot muted-dot"
              }
            />
            {duration(Math.min(seconds, limits.maxDurationSeconds))}
            <span>/ {duration(limits.maxDurationSeconds)}</span>
          </span>
          <div>
            <button className="button button-ghost" onClick={togglePause}>
              {phase === "paused" ? <Play size={17} /> : <Pause size={17} />}{" "}
              {phase === "paused" ? "Resume" : "Pause"}
            </button>
            <button className="button button-dark" onClick={stop}>
              <Square size={14} fill="currentColor" /> Finish recording
            </button>
          </div>
        </div>
      ) : phase !== "preview" ? (
        <div className="recorder-options">
          <span>
            <Monitor size={17} /> Screen
          </span>
          <button
            className="mic-toggle"
            role="switch"
            aria-checked={microphone}
            aria-label="Microphone"
            onClick={() => setMicrophone(!microphone)}
            disabled={phase === "choosing"}
          >
            {microphone ? <Mic size={17} /> : <MicOff size={17} />}
            <span>Microphone</span>
            <span className={`switch ${microphone ? "on" : ""}`}>
              <span />
            </span>
          </button>
          <span className="record-limit">
            Up to {duration(limits.maxDurationSeconds)}
          </span>
        </div>
      ) : null}
      {phase === "preview" && (
        <div className="preview-details">
          <div className="preview-meta">
            <span>
              <Check size={16} /> Recorded on this device
            </span>
            <span>
              {duration(seconds)} ·{" "}
              {((recording?.size || 0) / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
          <label
            className="field-label"
            htmlFor={compact ? "clip-title-compact" : "clip-title"}
          >
            Give your clip a name
          </label>
          <input
            id={compact ? "clip-title-compact" : "clip-title"}
            maxLength={200}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (draftRef.current) {
                const draft = { ...draftRef.current, title: e.target.value };
                draftRef.current = draft;
                draftWrite.current = draftWrite.current
                  .then(() => saveDraft(draft))
                  .catch(() => {});
              }
            }}
            placeholder="A quick walkthrough…"
            disabled={uploading}
          />
          <div className="preview-actions">
            <button
              className="icon-button"
              aria-label="Discard recording"
              title="Discard recording"
              onClick={discard}
              disabled={uploading}
            >
              <Trash2 size={18} />
            </button>
            <button
              className="button button-ghost"
              onClick={discard}
              disabled={uploading}
            >
              <RotateCcw size={16} /> Record again
            </button>
            <a
              className="button button-outline"
              href={previewUrl}
              download={`${
                title
                  .trim()
                  .replace(/[^a-zA-Z0-9 _-]/g, "")
                  .slice(0, 100) || "my-clip"
              }.${recording?.type.includes("mp4") ? "mp4" : "webm"}`}
            >
              <Download size={16} /> Download
            </a>
            {cloudConfigured && user && (
              <button
                className="button button-dark"
                disabled={
                  !title.trim() ||
                  uploading ||
                  (recording?.size || 0) > limits.maxVideoBytes
                }
                onClick={upload}
              >
                {uploading ? (
                  <>
                    <LoaderCircle size={16} className="spin" />{" "}
                    {progress === 100 ? "Finishing…" : `${progress}%`}
                  </>
                ) : (
                  <>
                    <Upload size={16} /> Upload clip
                  </>
                )}
              </button>
            )}
          </div>
          {uploading && (
            <progress aria-label="Upload progress" value={progress} max={100} />
          )}
          <p className="preview-note">
            {!cloudConfigured ? (
              "Your recording stays on this device. Download it to keep a copy. Cloud sharing isn’t connected yet."
            ) : !user ? (
              <>
                Download your recording, or{" "}
                <Link href="/login" target="_blank">
                  log in <ArrowRight size={12} />
                </Link>{" "}
                to upload it. Keep this tab open.
              </>
            ) : (
              "Your clip stays private until you create a share link."
            )}
          </p>
        </div>
      )}
      {error && (
        <div className="recorder-error">
          <ErrorNotice>{error}</ErrorNotice>
        </div>
      )}
      {!compact && phase === "idle" && (
        <div className="recorder-security">
          <ShieldCheck size={16} /> Nothing is recorded until you choose a
          screen.
        </div>
      )}
      {!compact && (
        <details className="speaker-notes">
          <summary>Speaker notes · visible only to you</summary>
          <textarea
            aria-label="Speaker notes"
            placeholder="Keep your talking points here…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <p>
            These notes are not drawn into the recording. Sharing your entire
            screen may still expose this page.
          </p>
        </details>
      )}
    </div>
  );
}
