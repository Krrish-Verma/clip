"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Crop,
  Film,
  LoaderCircle,
  Plus,
  Save,
  Scissors,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { duration, errorMessage, type ClipVideo } from "@/lib/types";
import { ErrorNotice, Loading } from "./ui";
import { Dialog } from "./dialog";

export type StudioDetails = {
  revision: number;
  jobStatus: string;
  failure?: string;
  transcriptStatus: string;
  transcriptError?: string;
  transcriptJson?: string;
  description: string;
  ctaLabel?: string;
  ctaUrl?: string;
};
type Segment = { videoId: string; start: number; end: number };
type Region = { x: number; y: number; width: number; height: number };
const initialCrop = { x: 0, y: 0, width: 1, height: 1 };
export function MediaStudio({ videoId }: { videoId: string }) {
  const [video, setVideo] = useState<ClipVideo | null>(null),
    [clips, setClips] = useState<ClipVideo[]>([]),
    [details, setDetails] = useState<StudioDetails | null>(null);
  const [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]),
    [crop, setCrop] = useState(initialCrop),
    [aspect, setAspect] = useState("landscape");
  const [overlay, setOverlay] = useState(""),
    [blurs, setBlurs] = useState<Region[]>([]),
    [boxes, setBoxes] = useState<Region[]>([]),
    [thumbnailAt, setThumbnailAt] = useState(0),
    [saved, setSaved] = useState(false);
  const player = useRef<HTMLVideoElement>(null);
  const load = useCallback(async () => {
    try {
      const [clip, library, studio, playback] = await Promise.all([
        api<ClipVideo>(`/api/videos/${videoId}`),
        api<ClipVideo[]>("/api/videos"),
        api<StudioDetails>(`/api/videos/${videoId}/studio`),
        api<{ playbackUrl: string }>(`/api/videos/${videoId}/playback`),
      ]);
      setVideo(clip);
      setClips(library.filter((v) => v.status === "READY" && v.canManage));
      setDetails(studio);
      setUrl(playback.playbackUrl);
      setSegments((previous) =>
        previous.length
          ? previous
          : [{ videoId, start: 0, end: clip.durationSeconds || 0 }],
      );
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [videoId]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!details || !["RUNNING", "QUEUED"].includes(details.jobStatus)) return;
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [details, load]);
  const total = segments.reduce((n, s) => n + Math.max(0, s.end - s.start), 0),
    processing = !!details && ["RUNNING", "QUEUED"].includes(details.jobStatus);
  function changeSegment(index: number, change: Partial<Segment>) {
    setSegments((previous) =>
      previous.map((segment, n) =>
        n === index ? { ...segment, ...change } : segment,
      ),
    );
    setSaved(false);
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/videos/${videoId}/studio/edits`, {
        method: "POST",
        body: JSON.stringify({
          segments,
          crop,
          blurs,
          boxes,
          overlayText: overlay,
          aspect,
          thumbnailAt,
        }),
      });
      setConfirm(false);
      setSaved(true);
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="app-main media-studio">
      <Link className="back-link" href={`/videos/${videoId}`}>
        <ArrowLeft size={16} /> Back to clip
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE YOUR FIRST TAKE YOUR BEST TAKE</span>
          <h1>{video?.title || "Video studio"}</h1>
          <p>Trim the edges. Keep the context. Share the same link.</p>
        </div>
        <button
          className="button button-dark"
          disabled={!video || busy || processing || total <= 0}
          onClick={() => setConfirm(true)}
        >
          {processing ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Save size={17} />
          )}{" "}
          {processing ? "Rendering revision…" : "Render changes"}
        </button>
      </div>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      {saved && (
        <div className="studio-notice">
          <Check size={17} />{" "}
          {processing
            ? "Your revision is rendering. The previous video stays available at the same link."
            : "Your latest revision is ready. The share link is unchanged."}
        </div>
      )}
      {details?.jobStatus === "FAILED" && (
        <ErrorNotice>
          The latest render failed. Your previous version is still available.
          Adjust the edit and try again.
        </ErrorNotice>
      )}
      {!video ? (
        <Loading text="Opening studio…" />
      ) : (
        <div className="studio-grid">
          <div>
            <video
              ref={player}
              src={url || undefined}
              controls
              playsInline
              className="video-player"
              aria-label="Original video preview"
            />
            <p className="studio-help">
              Preview the current revision here. Changes below are applied when
              you render.
            </p>
            <section className="studio-section">
              <h2>
                <Scissors size={18} /> Timeline · {duration(total)}
              </h2>
              <p>
                Keep one range to trim, split into multiple ranges to cut, or
                add another clip to stitch.
              </p>
              {segments.map((segment, index) => (
                <div className="segment-row" key={index}>
                  <span className="segment-number">{index + 1}</span>
                  <label>
                    Source
                    <select
                      aria-label={`Source clip ${index + 1}`}
                      value={segment.videoId}
                      disabled={processing}
                      onChange={(e) => {
                        const next = clips.find(
                          (c) => c.id === e.target.value,
                        )!;
                        changeSegment(index, {
                          videoId: next.id,
                          start: 0,
                          end: next.durationSeconds || 0,
                        });
                      }}
                    >
                      {clips.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    From (s)
                    <input
                      aria-label={`Start of segment ${index + 1}`}
                      type="number"
                      min={0}
                      step={0.1}
                      value={segment.start}
                      disabled={processing}
                      onChange={(e) =>
                        changeSegment(index, { start: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    To (s)
                    <input
                      aria-label={`End of segment ${index + 1}`}
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={segment.end}
                      disabled={processing}
                      onChange={(e) =>
                        changeSegment(index, { end: Number(e.target.value) })
                      }
                    />
                  </label>
                  <button
                    className="icon-button"
                    aria-label={`Remove segment ${index + 1}`}
                    disabled={processing || segments.length === 1}
                    onClick={() =>
                      setSegments(segments.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <div className="studio-actions">
                <button
                  className="button button-outline"
                  disabled={processing || segments.length >= 30}
                  onClick={() =>
                    setSegments([
                      ...segments,
                      { videoId, start: 0, end: video.durationSeconds || 0 },
                    ])
                  }
                >
                  <Plus size={15} /> Add clip / range
                </button>
                <button
                  className="button button-outline"
                  disabled={processing || segments.length >= 30}
                  onClick={() => {
                    const t = player.current?.currentTime || 0;
                    const index = segments.findIndex(
                      (s) => s.videoId === videoId && s.start < t && s.end > t,
                    );
                    if (index >= 0)
                      setSegments(
                        segments.flatMap((s, i) =>
                          i === index
                            ? [
                                { ...s, end: t },
                                { ...s, start: t },
                              ]
                            : [s],
                        ),
                      );
                  }}
                >
                  Split at playhead
                </button>
              </div>
            </section>
            <section className="studio-section">
              <h2>
                <Crop size={18} /> Framing
              </h2>
              <label>
                Output format
                <select
                  value={aspect}
                  onChange={(e) => setAspect(e.target.value)}
                >
                  <option value="landscape">Landscape · 16:9</option>
                  <option value="square">Square · 1:1</option>
                  <option value="portrait">Portrait · 9:16</option>
                </select>
              </label>
              <div className="crop-fields">
                {Object.entries(crop).map(([key, value]) => (
                  <label key={key}>
                    {key} (%)
                    <input
                      type="number"
                      min={key === "x" || key === "y" ? 0 : 2}
                      max={100}
                      step={1}
                      value={Math.round(value * 100)}
                      onChange={(e) =>
                        setCrop({
                          ...crop,
                          [key]: Number(e.target.value) / 100,
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <button
                className="inline-button"
                onClick={() => setCrop(initialCrop)}
              >
                Reset crop
              </button>
            </section>
          </div>
          <aside>
            <section className="studio-section">
              <h2>
                <Film size={18} /> Finish the frame
              </h2>
              <label>
                Text overlay
                <input
                  value={overlay}
                  maxLength={200}
                  onChange={(e) => setOverlay(e.target.value)}
                  placeholder="A label, a takeaway, a little clarity"
                />
              </label>
              <label>
                Thumbnail at (seconds)
                <input
                  type="number"
                  min={0}
                  max={total}
                  step={0.1}
                  value={thumbnailAt}
                  onChange={(e) => setThumbnailAt(Number(e.target.value))}
                />
              </label>
              <button
                className="inline-button"
                onClick={() =>
                  setThumbnailAt(
                    Math.min(total, player.current?.currentTime || 0),
                  )
                }
              >
                Use current playhead
              </button>
              <p>
                Blur and box regions use percentages of the final output frame.
                Each applies across this revision.
              </p>
              {(
                [
                  ["Blur", blurs, setBlurs],
                  ["Box", boxes, setBoxes],
                ] as const
              ).map(([label, regions, setRegions]) => (
                <div className="region-group" key={label}>
                  <h3>{label} regions</h3>
                  {regions.map((region, index) => (
                    <div key={index} className="region-fields">
                      {Object.entries(region).map(([key, value]) => (
                        <label key={key}>
                          {key} %
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={Math.round(value * 100)}
                            onChange={(e) =>
                              setRegions(
                                regions.map((r, i) =>
                                  i === index
                                    ? {
                                        ...r,
                                        [key]: Number(e.target.value) / 100,
                                      }
                                    : r,
                                ),
                              )
                            }
                          />
                        </label>
                      ))}
                      <button
                        className="icon-button"
                        aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
                        onClick={() =>
                          setRegions(regions.filter((_, i) => i !== index))
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="button button-outline"
                    disabled={regions.length >= 10}
                    onClick={() =>
                      setRegions([
                        ...regions,
                        { x: 0.1, y: 0.1, width: 0.25, height: 0.15 },
                      ])
                    }
                  >
                    <Plus size={14} /> Add {label.toLowerCase()}
                  </button>
                </div>
              ))}
            </section>
            <div className="studio-notice">
              Edits create a new media revision. Previous media stays available
              while it renders; existing share links continue to work.
            </div>
          </aside>
        </div>
      )}
      {confirm && (
        <Dialog title="Render this revision?" onClose={() => setConfirm(false)}>
          <p>
            {segments.length} ranges · {duration(total)} · {aspect}.
            Conversation timestamps refer to the previous timeline; review them
            after trimming or stitching.
          </p>
          <div className="dialog-actions">
            <button
              className="button button-outline"
              onClick={() => setConfirm(false)}
            >
              Keep editing
            </button>
            <button
              className="button button-dark"
              disabled={busy}
              onClick={() => void save()}
            >
              Render revision
            </button>
          </div>
        </Dialog>
      )}
    </main>
  );
}
