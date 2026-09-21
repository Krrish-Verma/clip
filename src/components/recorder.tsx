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
} from "lucide-react";
import { api, cloudConfigured, uploadMedia } from "@/lib/api";
import { duration, errorMessage, type ClipVideo } from "@/lib/types";
import { useSession } from "./session-provider";
import { ErrorNotice } from "./ui";
import { Dialog } from "./dialog";

type Phase = "idle" | "choosing" | "recording" | "paused" | "preview";
const MAX_BYTES = 200 * 1024 * 1024;
const MAX_SECONDS = 600;

export function Recorder({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { user } = useSession();
  const [phase, setPhase] = useState<Phase>("idle");
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
  const context = useRef<AudioContext | null>(null);
  const liveVideo = useRef<HTMLVideoElement>(null);
  const liveStream = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef("");
  const mounted = useRef(true);
  const uploadedVideo = useRef<{
    videoId: string;
    uploadUrl: string;
    sent: boolean;
  } | null>(null);

  const releaseDevices = useCallback(() => {
    streams.current.forEach((stream) =>
      stream.getTracks().forEach((track) => track.stop()),
    );
    streams.current = [];
    if (context.current) {
      void context.current.close().catch(() => {});
      context.current = null;
    }
    liveStream.current = null;
  }, []);

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
    if (seconds >= MAX_SECONDS && phase === "recording") stop();
  }, [seconds, phase, stop]);
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
      !navigator.mediaDevices?.getDisplayMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Screen recording isn’t supported in this browser. Open Clip in a desktop browser such as Chrome or Edge.",
      );
      return;
    }
    setPhase("choosing");
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });
      streams.current.push(display);
      if (!mounted.current) {
        releaseDevices();
        return;
      }
      let microphoneStream: MediaStream | null = null;
      if (microphone) {
        microphoneStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        streams.current.push(microphoneStream);
      }
      if (!mounted.current) {
        releaseDevices();
        return;
      }
      if (!display.active)
        throw new Error("Screen sharing ended before recording could start.");
      const audioSources = [display, microphoneStream].filter(
        (stream): stream is MediaStream =>
          Boolean(stream?.getAudioTracks().length),
      );
      const combined = new MediaStream(display.getVideoTracks());
      if (audioSources.length) {
        context.current = new AudioContext();
        await context.current.resume();
        const destination = context.current.createMediaStreamDestination();
        audioSources.forEach((stream) =>
          context
            .current!.createMediaStreamSource(
              new MediaStream(stream.getAudioTracks()),
            )
            .connect(destination),
        );
        destination.stream
          .getAudioTracks()
          .forEach((track) => combined.addTrack(track));
      }
      streams.current.push(combined);
      const mimeType = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const media = new MediaRecorder(combined, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 1_800_000,
        audioBitsPerSecond: 96_000,
      });
      recorder.current = media;
      const chunks: Blob[] = [];
      let bytes = 0;
      let failed = false;
      media.ondataavailable = (event) => {
        if (!event.data.size) return;
        chunks.push(event.data);
        bytes += event.data.size;
        if (bytes >= MAX_BYTES && media.state !== "inactive") {
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
      media.onstop = () => {
        releaseDevices();
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
        if (blob.size > MAX_BYTES)
          setError(
            "This recording exceeds the 200 MB upload limit. You can download it or record a shorter clip.",
          );
      };
      display.getVideoTracks()[0].onended = stop;
      liveStream.current = display;
      setRecording(null);
      uploadedVideo.current = null;
      setSeconds(0);
      media.start(1000);
      setPhase("recording");
    } catch (error) {
      releaseDevices();
      if (!mounted.current) return;
      setPhase("idle");
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
    if (recording.size > MAX_BYTES) {
      setError("Your recording must be smaller than 200 MB.");
      return;
    }
    setUploading(true);
    setError("");
    setProgress(0);
    try {
      if (!uploadedVideo.current) {
        const library = await api<ClipVideo[]>("/api/videos");
        if (library.length >= 5) {
          throw new Error(
            "Your library has reached its 5-video limit. Download this recording to keep it, or delete an existing clip before uploading.",
          );
        }
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
      }
      const current = uploadedVideo.current;
      if (!current.sent) {
        await uploadMedia(current.uploadUrl, recording, setProgress);
        current.sent = true;
      }
      await api(`/api/videos/${current.videoId}/complete`, { method: "POST" });
      setRecording(null);
      router.push(`/videos/${current.videoId}`);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  const active = phase === "recording" || phase === "paused";
  return (
    <div className={`recorder ${compact ? "recorder-compact" : ""}`}>
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
              disabled={phase === "choosing"}
            >
              {phase === "choosing" ? (
                <>
                  <LoaderCircle className="spin" size={17} /> Choose your
                  screen…
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
        <div className="recording-controls">
          <span className="timer">
            <span
              className={
                phase === "recording"
                  ? "record-dot pulse"
                  : "record-dot muted-dot"
              }
            />
            {duration(Math.min(seconds, MAX_SECONDS))}
            <span>/ 10:00</span>
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
          <span className="record-limit">Up to 10 minutes</span>
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
            onChange={(e) => setTitle(e.target.value)}
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
                  (recording?.size || 0) > MAX_BYTES
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
    </div>
  );
}
