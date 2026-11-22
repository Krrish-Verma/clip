"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Download,
  FileText,
  LoaderCircle,
  Search,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { downloadBlob } from "@/lib/capture";
import { duration, errorMessage } from "@/lib/types";
import type { StudioDetails } from "./media-studio";
import { ErrorNotice } from "./ui";
import { Dialog } from "./dialog";
type Segment = { start: number; end: number; text: string };
type Transcript = {
  segments: Segment[];
  summary?: string;
  suggestedTitle?: string;
  chapters?: { start: number; title: string }[];
  tasks?: string[];
  redactions?: { start: number; end: number; reason: string }[];
  suggestedCuts?: { start: number; end: number; reason: string }[];
};
function timestamp(seconds: number) {
  return new Date(Math.max(0, seconds) * 1000).toISOString().slice(11, 23);
}
export function TranscriptPanel({
  videoId,
  shareToken,
  onSeek,
  onCaptions,
  durationSeconds,
  canManage = false,
}: {
  videoId: string;
  shareToken?: string;
  onSeek: (time: number) => void;
  onCaptions: (url: string) => void;
  durationSeconds: number;
  canManage?: boolean;
}) {
  const [details, setDetails] = useState<StudioDetails | null>(null),
    [transcript, setTranscript] = useState<Transcript | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState("");
  const [tab, setTab] = useState("transcript"),
    [editing, setEditing] = useState(false),
    [selected, setSelected] = useState<number[]>([]),
    [confirm, setConfirm] = useState<"segments" | "suggestions" | null>(null);
  const [description, setDescription] = useState(""),
    [ctaLabel, setCtaLabel] = useState(""),
    [ctaUrl, setCtaUrl] = useState("");
  const base = `/api/videos/${videoId}/studio`,
    access = shareToken ? `?shareToken=${encodeURIComponent(shareToken)}` : "";
  const load = useCallback(async () => {
    try {
      const data = await api<StudioDetails>(base + access);
      setDetails(data);
      setTranscript(
        data.transcriptJson ? JSON.parse(data.transcriptJson) : null,
      );
      setDescription(data.description || "");
      setCtaLabel(data.ctaLabel || "");
      setCtaUrl(data.ctaUrl || "");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [base, access]);
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    return () => clearTimeout(initial);
  }, [load]);
  useEffect(() => {
    if (!details || !["QUEUED", "RUNNING"].includes(details.transcriptStatus))
      return;
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [details, load]);
  const vtt = transcript
    ? "WEBVTT\n\n" +
      transcript.segments
        .map(
          (s, i) =>
            `${i + 1}\n${timestamp(s.start)} --> ${timestamp(s.end)}\n${s.text.replace(/-->/g, "→")}\n`,
        )
        .join("\n")
    : "";
  useEffect(() => {
    if (!vtt) return;
    const url = URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
    onCaptions(url);
    return () => {
      URL.revokeObjectURL(url);
      onCaptions("");
    };
  }, [vtt, onCaptions]);
  async function perform(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function removeRanges() {
    if (!transcript) return;
    const cuts =
      confirm === "segments"
        ? selected.map((index) => transcript.segments[index])
        : transcript.suggestedCuts || [];
    const sorted = [...cuts].sort((a, b) => a.start - b.start);
    const total = durationSeconds;
    let position = 0;
    const segments: { videoId: string; start: number; end: number }[] = [];
    for (const cut of sorted) {
      if (cut.start > position + 0.1)
        segments.push({ videoId, start: position, end: cut.start });
      position = Math.max(position, cut.end);
    }
    if (position < total - 0.1)
      segments.push({ videoId, start: position, end: total });
    if (!segments.length) {
      setError("Keep at least one part of the clip.");
      return;
    }
    await perform(async () => {
      await api(`${base}/edits`, {
        method: "POST",
        body: JSON.stringify({ segments, aspect: "landscape", thumbnailAt: 0 }),
      });
      setSelected([]);
      setConfirm(null);
    });
  }
  return (
    <section className="transcript-panel">
      <div className="transcript-tabs" role="group" aria-label="Video details">
        {["transcript", "highlights", ...(canManage ? ["details"] : [])].map(
          (item) => (
            <button
              key={item}
              className={tab === item ? "selected" : ""}
              aria-pressed={tab === item}
              onClick={() => setTab(item)}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ),
        )}
      </div>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      {tab === "details" && canManage ? (
        <form
          className="studio-section"
          onSubmit={(e) => {
            e.preventDefault();
            void perform(() =>
              api(base, {
                method: "PATCH",
                body: JSON.stringify({ description, ctaLabel, ctaUrl }),
              }),
            );
          }}
        >
          <label>
            Description
            <textarea
              value={description}
              maxLength={3000}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Give viewers some context…"
            />
          </label>
          <label>
            Action button label
            <input
              value={ctaLabel}
              maxLength={80}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder="e.g. View the project"
            />
          </label>
          <label>
            Action URL
            <input
              type="url"
              value={ctaUrl}
              maxLength={1000}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <button className="button button-dark" disabled={busy}>
            <Check size={16} /> Save details
          </button>
        </form>
      ) : (
        <>
          {details?.description && (
            <p className="video-description">{details.description}</p>
          )}
          {details?.ctaUrl && details.ctaLabel && (
            <a
              className="button button-dark video-cta"
              href={details.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {details.ctaLabel} ↗
            </a>
          )}
          {!transcript ? (
            <div className="transcript-empty">
              <FileText size={29} />
              <h3>
                {details &&
                ["QUEUED", "RUNNING"].includes(details.transcriptStatus)
                  ? "Finding the words…"
                  : "Every word, easy to find."}
              </h3>
              <p>
                {details?.transcriptError ||
                  "Generate a searchable transcript and captions using private speech recognition."}
              </p>
              {canManage && (
                <button
                  className="button button-outline"
                  disabled={
                    busy ||
                    ["QUEUED", "RUNNING"].includes(
                      details?.transcriptStatus || "",
                    )
                  }
                  onClick={() =>
                    void perform(() =>
                      api(`${base}/transcribe`, { method: "POST" }),
                    )
                  }
                >
                  {["QUEUED", "RUNNING"].includes(
                    details?.transcriptStatus || "",
                  ) ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}{" "}
                  Generate transcript
                </button>
              )}
            </div>
          ) : tab === "highlights" ? (
            <div className="transcript-highlights">
              <small>
                Extractive suggestions from the transcript. Review for accuracy.
              </small>
              <h3>At a glance</h3>
              <p>{transcript.summary || "No speech was detected."}</p>
              <h3>Chapters</h3>
              {transcript.chapters?.map((chapter, i) => (
                <button
                  className="chapter-link"
                  key={i}
                  onClick={() => onSeek(chapter.start)}
                >
                  <span>{duration(chapter.start)}</span>
                  {chapter.title}
                </button>
              ))}
              <h3>Possible action items</h3>
              {transcript.tasks?.length ? (
                <ul>
                  {transcript.tasks.map((task, i) => (
                    <li key={i}>{task}</li>
                  ))}
                </ul>
              ) : (
                <p>No action items identified.</p>
              )}
              {canManage && (
                <>
                  <h3>Privacy review</h3>
                  {transcript.redactions?.length ? (
                    transcript.redactions.map((r, i) => (
                      <p key={i}>
                        <button
                          className="timestamp"
                          onClick={() => onSeek(r.start)}
                        >
                          {duration(r.start)}
                        </button>
                        {r.reason}
                      </p>
                    ))
                  ) : (
                    <p>
                      No email addresses or credential patterns flagged. This is
                      not a guarantee that the video contains no sensitive
                      information.
                    </p>
                  )}
                  {!!transcript.suggestedCuts?.length && (
                    <button
                      className="button button-outline"
                      disabled={busy}
                      onClick={() => setConfirm("suggestions")}
                    >
                      Review {transcript.suggestedCuts.length} silence/filler
                      cuts
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              <div className="transcript-toolbar">
                <div className="search-field">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search transcript"
                    placeholder="Find a word or phrase…"
                  />
                </div>
                <button
                  className="icon-button"
                  aria-label="Download captions"
                  title="Download VTT captions"
                  onClick={() =>
                    downloadBlob(
                      new Blob([vtt], { type: "text/vtt" }),
                      "clip-captions.vtt",
                    )
                  }
                >
                  <Download size={17} />
                </button>
                <button
                  className="button button-outline"
                  onClick={() =>
                    downloadBlob(
                      new Blob(
                        [transcript.segments.map((s) => s.text).join("\n")],
                        { type: "text/plain" },
                      ),
                      "clip-transcript.txt",
                    )
                  }
                >
                  Export text
                </button>
                {canManage && (
                  <button
                    className="button button-outline"
                    disabled={busy}
                    onClick={() => setEditing(!editing)}
                  >
                    {editing ? "Cancel editing" : "Edit transcript"}
                  </button>
                )}
              </div>
              <div className="transcript-segments">
                {transcript.segments.map((segment, index) =>
                  segment.text.toLowerCase().includes(query.toLowerCase()) ? (
                    <div className="transcript-segment" key={index}>
                      {canManage && (
                        <input
                          type="checkbox"
                          aria-label={`Select segment at ${duration(segment.start)}`}
                          checked={selected.includes(index)}
                          onChange={(e) =>
                            setSelected(
                              e.target.checked
                                ? [...selected, index]
                                : selected.filter((n) => n !== index),
                            )
                          }
                        />
                      )}
                      <button
                        className="timestamp"
                        onClick={() => onSeek(segment.start)}
                      >
                        {duration(segment.start)}
                      </button>
                      {editing ? (
                        <textarea
                          aria-label={`Transcript at ${duration(segment.start)}`}
                          value={segment.text}
                          maxLength={2000}
                          onChange={(e) =>
                            setTranscript({
                              ...transcript,
                              segments: transcript.segments.map((s, i) =>
                                i === index
                                  ? { ...s, text: e.target.value }
                                  : s,
                              ),
                            })
                          }
                        />
                      ) : (
                        <p>{segment.text}</p>
                      )}
                    </div>
                  ) : null,
                )}
              </div>
              {canManage && (
                <div className="studio-actions">
                  {editing && (
                    <button
                      className="button button-dark"
                      disabled={busy}
                      onClick={() =>
                        void perform(async () => {
                          await api(`${base}/transcript`, {
                            method: "PATCH",
                            body: JSON.stringify({
                              revision: details?.revision,
                              segments: transcript.segments,
                            }),
                          });
                          setEditing(false);
                        })
                      }
                    >
                      Save transcript
                    </button>
                  )}
                  {selected.length > 0 && (
                    <button
                      className="button button-outline"
                      disabled={busy}
                      onClick={() => setConfirm("segments")}
                    >
                      Remove {selected.length} selected ranges from video
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
      {confirm && (
        <Dialog
          title="Review the proposed cuts"
          onClose={() => setConfirm(null)}
        >
          <p>
            This renders a new video revision and keeps the same share link.
            Review these ranges before removing them.
          </p>
          <div className="cut-review">
            {(confirm === "segments"
              ? selected.map((i) => ({
                  ...transcript!.segments[i],
                  reason: "Selected transcript",
                }))
              : transcript?.suggestedCuts || []
            ).map((cut, i) => (
              <p key={i}>
                {duration(cut.start)}–{duration(cut.end)} · {cut.reason}
              </p>
            ))}
          </div>
          <div className="dialog-actions">
            <button
              className="button button-outline"
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
            <button
              className="button button-dark"
              disabled={busy}
              onClick={() => void removeRanges()}
            >
              Render without these ranges
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
