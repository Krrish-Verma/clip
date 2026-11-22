"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  Clock3,
  Copy,
  Eye,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  RotateCcw,
  Trash2,
  VideoOff,
} from "lucide-react";
import { api, cloudConfigured } from "@/lib/api";
import { duration, errorMessage, type ClipVideo } from "@/lib/types";
import { useSession } from "./session-provider";
import { Dialog } from "./dialog";
import { Conversation } from "./conversation";
import { TranscriptPanel } from "./transcript-panel";
import { ErrorNotice, Loading } from "./ui";

type SharedVideo = ClipVideo & { playbackUrl: string };
export function VideoView({
  videoId,
  shareToken,
}: {
  videoId?: string;
  shareToken?: string;
}) {
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const shared = Boolean(shareToken);
  const [video, setVideo] = useState<ClipVideo | null>(null);
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [dialog, setDialog] = useState<"rename" | "delete" | "share" | null>(
    null,
  );
  const [linkPassword, setLinkPassword] = useState("");
  const [linkExpiry, setLinkExpiry] = useState("");
  const [viewerPassword, setViewerPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [captions, setCaptions] = useState("");
  const [revisions, setRevisions] = useState<
    { revision: number; durationSeconds: number; playbackUrl: string }[]
  >([]);
  const [selectedRevision, setSelectedRevision] = useState(0);
  const pendingSeek = useRef<number | null>(null);
  const player = useRef<HTMLVideoElement>(null);
  const sessionId = useRef<string | null>(null);
  const starting = useRef(false);
  const tracked = useRef(false);
  const refreshingPlayback = useRef(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accessQuery = shareToken
    ? `?shareToken=${encodeURIComponent(shareToken)}`
    : "";
  const id = video?.id || videoId;

  const load = useCallback(() => {
    const request = shareToken
      ? api<SharedVideo>(`/api/shares/${encodeURIComponent(shareToken)}`).then(
          (data) => ({ video: data, playbackUrl: data.playbackUrl }),
        )
      : api<ClipVideo>(`/api/videos/${videoId}`).then(async (data) => ({
          video: data,
          playbackUrl:
            data.status === "READY"
              ? (
                  await api<{ playbackUrl: string }>(
                    `/api/videos/${videoId}/playback`,
                  )
                ).playbackUrl
              : "",
        }));
    return request
      .then((result) => {
        setVideo(result.video);
        setSelectedRevision(result.video.publishedRevision || 0);
        setPlaybackUrl(result.playbackUrl);
        setError("");
      })
      .catch((error) => setError(errorMessage(error)))
      .finally(() => setLoading(false));
  }, [videoId, shareToken]);
  useEffect(() => {
    if (!id) return;
    void api<typeof revisions>(
      `/api/videos/${id}/studio/revisions${accessQuery}`,
    )
      .then(setRevisions)
      .catch(() => {});
  }, [id, accessQuery]);
  useEffect(() => {
    if (!sessionLoading || shared) void load();
  }, [load, sessionLoading, shared, user?.id]);
  useEffect(() => {
    if (!video || !["PROCESSING", "UPLOADING"].includes(video.status)) return;
    const timer = setInterval(() => {
      void load();
    }, 6000);
    return () => clearInterval(timer);
  }, [video, load]);
  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  const track = useCallback(
    async (eventType: "START" | "PROGRESS" | "PAUSE" | "COMPLETE") => {
      const element = player.current;
      if (
        !element ||
        !id ||
        !cloudConfigured ||
        selectedRevision !== (video?.publishedRevision || 0) ||
        starting.current ||
        !Number.isFinite(element.duration)
      )
        return;
      if (!tracked.current && element.currentTime < 2) return;
      try {
        let anonymousViewerId: string;
        try {
          anonymousViewerId =
            localStorage.getItem("clip-anonymous-viewer") ||
            crypto.randomUUID();
          localStorage.setItem("clip-anonymous-viewer", anonymousViewerId);
        } catch {
          anonymousViewerId = sessionId.current || crypto.randomUUID();
        }
        starting.current = true;
        const result = await api<{ sessionId: string }>(
          `/api/videos/${id}/analytics/progress${accessQuery}`,
          {
            method: "POST",
            body: JSON.stringify({
              sessionId: sessionId.current,
              anonymousViewerId,
              positionSeconds: element.currentTime,
              durationSeconds: element.duration,
              eventType: tracked.current ? eventType : "START",
            }),
            keepalive: eventType === "PAUSE",
          },
        );
        sessionId.current = result.sessionId;
        tracked.current = true;
      } catch {
        /* Viewing is still available when analytics cannot be delivered. */
      } finally {
        starting.current = false;
      }
    },
    [id, accessQuery, selectedRevision, video?.publishedRevision],
  );
  useEffect(() => {
    const timer = setInterval(() => {
      if (player.current && !player.current.paused) void track("PROGRESS");
    }, 12000);
    const hide = () => {
      if (document.visibilityState === "hidden") void track("PAUSE");
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hide);
    };
  }, [track]);

  async function action(work: () => Promise<void>) {
    setPending(true);
    setActionError("");
    try {
      await work();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  async function share() {
    await action(async () => {
      const result = await api<{ shareUrl: string }>(
        `/api/videos/${id}/share`,
        {
          method: "POST",
          body: JSON.stringify({
            password: linkPassword || null,
            expiresAt: linkExpiry ? new Date(linkExpiry).toISOString() : null,
          }),
        },
      );
      setShareUrl(result.shareUrl);
      setDialog(null);
      await load();
    });
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      setActionError(
        "Clipboard access wasn’t available. Select and copy the link above.",
      );
    }
  }
  async function refreshPlayback() {
    if (!id || refreshingPlayback.current) return;
    refreshingPlayback.current = true;
    const resumeAt = player.current?.currentTime || 0;
    try {
      if (selectedRevision !== (video?.publishedRevision || 0)) {
        const versions = await api<typeof revisions>(
          `/api/videos/${id}/studio/revisions${accessQuery}`,
        );
        setRevisions(versions);
        const version = versions.find((v) => v.revision === selectedRevision);
        if (!version)
          throw new Error("This media revision is no longer available.");
        pendingSeek.current = resumeAt;
        setPlaybackUrl(version.playbackUrl);
        return;
      }
      const next = shareToken
        ? await api<SharedVideo>(
            `/api/shares/${encodeURIComponent(shareToken)}`,
          )
        : await api<{ playbackUrl: string }>(`/api/videos/${id}/playback`);
      pendingSeek.current = resumeAt;
      setPlaybackUrl(next.playbackUrl);
      setActionError("");
      window.setTimeout(() => {
        if (player.current) {
          player.current.currentTime = resumeAt;
          void player.current.play().catch(() => {});
        }
      }, 0);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      refreshingPlayback.current = false;
    }
  }
  if (loading)
    return (
      <main id="main" className="app-main">
        <Loading text="Opening your clip…" />
      </main>
    );
  if (error || !video)
    return (
      <main id="main" className="not-found">
        <VideoOff size={38} />
        <h1>
          {!cloudConfigured
            ? "A home for your next clip."
            : "This clip is out of the picture."}
        </h1>
        <p>{error || "This video could not be found."}</p>
        {shared && error.includes("requires a password") && (
          <form
            className="share-unlock"
            onSubmit={(event) => {
              event.preventDefault();
              try {
                sessionStorage.setItem(
                  `clip-share:${shareToken}`,
                  viewerPassword,
                );
                void load();
              } catch {
                setError("Enable tab storage to unlock this link.");
              }
            }}
          >
            <label className="field-label" htmlFor="share-password">
              Link password
            </label>
            <input
              id="share-password"
              type="password"
              autoComplete="current-password"
              value={viewerPassword}
              onChange={(e) => setViewerPassword(e.target.value)}
              maxLength={72}
              required
            />
            <button className="button button-dark">Unlock clip</button>
          </form>
        )}
        <Link className="button button-dark" href={shared ? "/" : "/dashboard"}>
          <ArrowLeft size={16} />
          {shared ? "Meet Clip" : "Back to library"}
        </Link>
      </main>
    );

  return (
    <main id="main" className="app-main video-page">
      <Link className="back-link" href={shared ? "/" : "/dashboard"}>
        <ArrowLeft size={16} />
        {shared ? "Made with Clip" : "My library"}
      </Link>
      <div className="video-heading">
        <div>
          <h1>{video.title}</h1>
          <p>
            {shared
              ? `A clip by ${video.creatorDisplayName || "the creator"}`
              : `Created ${new Date(video.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`}
          </p>
        </div>
        {!shared && video.canManage !== false && (
          <div className="video-actions">
            <Link className="button button-outline" href={`/videos/${id}/edit`}>
              Edit video
            </Link>
            <button
              className="icon-button"
              aria-label="Rename video"
              onClick={() => setDialog("rename")}
            >
              <Pencil size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Delete video"
              onClick={() => setDialog("delete")}
            >
              <Trash2 size={17} />
            </button>
            <Link
              className="button button-outline"
              href={`/videos/${id}/analytics`}
            >
              <BarChart3 size={16} /> Insights
            </Link>
            <button
              className="button button-dark"
              onClick={() => setDialog("share")}
              disabled={pending || video.status !== "READY"}
            >
              <Link2 size={16} /> Share clip
            </button>
          </div>
        )}
      </div>
      {actionError && (
        <div className="action-error">
          <ErrorNotice>{actionError}</ErrorNotice>
        </div>
      )}
      {shareUrl && (
        <div className="share-box">
          <p>
            {linkPassword
              ? "Viewers need the link and password to watch and comment."
              : "Anyone with this link can watch and leave a comment."}
            {linkExpiry
              ? ` Expires ${new Date(linkExpiry).toLocaleString()}.`
              : ""}
          </p>
          <div>
            <input
              value={shareUrl}
              readOnly
              aria-label="Share link"
              onFocus={(event) => event.target.select()}
            />
            <button className="button button-dark" onClick={copy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <button
            className="inline-button"
            disabled={pending}
            onClick={() =>
              action(async () => {
                await api(`/api/videos/${id}/share`, { method: "DELETE" });
                setShareUrl("");
                await load();
              })
            }
          >
            Disable sharing
          </button>
          <button
            className="inline-button"
            onClick={() =>
              void action(async () => {
                const embedUrl = shareUrl.replace("/s/", "/embed/");
                await navigator.clipboard.writeText(
                  `<iframe src="${embedUrl}" title="Clip video" width="720" height="450" allow="fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>`,
                );
                setCopied(true);
              })
            }
          >
            Copy embed code
          </button>
        </div>
      )}
      <div className="video-content">
        <div>
          {playbackUrl ? (
            <video
              ref={player}
              src={playbackUrl}
              controls
              playsInline
              className="video-player"
              aria-label={video.title}
              onTimeUpdate={() => {
                const time = player.current?.currentTime || 0;
                setCurrentTime(time);
                if (!tracked.current && time >= 2) void track("START");
              }}
              onPlay={() => void track("START")}
              onPause={() => void track("PAUSE")}
              onEnded={() => void track("COMPLETE")}
              onError={() => void refreshPlayback()}
              onLoadedMetadata={() => {
                if (pendingSeek.current !== null && player.current) {
                  player.current.currentTime = pendingSeek.current;
                  pendingSeek.current = null;
                  void player.current.play().catch(() => {});
                }
              }}
            >
              <track
                kind="captions"
                src={captions || undefined}
                srcLang="en"
                label="Transcript"
                default
              />
            </video>
          ) : (
            <div className="player-empty">
              {video.status === "FAILED" ? (
                <VideoOff size={36} strokeWidth={1.3} />
              ) : (
                <LoaderCircle size={33} className="spin" />
              )}
              <h2>
                {video.status === "FAILED"
                  ? "This clip needs another take."
                  : video.status === "UPLOADING"
                    ? "Your clip is on its way."
                    : "Getting your clip ready."}
              </h2>
              <p>
                {video.status === "FAILED"
                  ? "Something interrupted processing. Try again to prepare your recording for playback."
                  : "We’re preparing your recording. This page will update when it’s ready."}
              </p>
              {video.status === "FAILED" && !shared && (
                <button
                  className="button button-dark"
                  disabled={pending}
                  onClick={() =>
                    action(async () => {
                      await api(`/api/videos/${id}/retry`, { method: "POST" });
                      await load();
                    })
                  }
                >
                  <RotateCcw size={16} /> Retry processing
                </button>
              )}
            </div>
          )}
          <div className="player-footer">
            {revisions.length > 1 && (
              <label>
                Revision{" "}
                <select
                  aria-label="Video revision"
                  value={selectedRevision}
                  onChange={(e) => {
                    const revision = Number(e.target.value);
                    const version = revisions.find(
                      (v) => v.revision === revision,
                    );
                    if (version) {
                      setSelectedRevision(revision);
                      setPlaybackUrl(version.playbackUrl);
                    }
                  }}
                >
                  {revisions.map((r) => (
                    <option value={r.revision} key={r.revision}>
                      {r.revision + 1}
                      {r.revision === (video.publishedRevision || 0)
                        ? " · latest"
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span>
              <Clock3 size={14} />
              {duration(video.durationSeconds)}
            </span>
            {!shared && (
              <>
                <span>
                  <Eye size={14} />
                  {video.views} views
                </span>
                <span>
                  <LockKeyhole size={13} />
                  {video.visibility === "PRIVATE" ? "Private" : "Unlisted"}
                </span>
                <Link href={`/videos/${id}/analytics`}>
                  View insights <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
          {video.status === "READY" &&
            selectedRevision === (video.publishedRevision || 0) && (
              <TranscriptPanel
                videoId={video.id}
                durationSeconds={video.durationSeconds || 0}
                canManage={!shared && video.canManage !== false}
                shareToken={shareToken}
                onSeek={(time) => {
                  if (player.current) {
                    player.current.currentTime = time;
                    void player.current.play().catch(() => {});
                  }
                }}
                onCaptions={setCaptions}
              />
            )}
        </div>
        <Conversation
          videoId={video.id}
          shareToken={shareToken}
          currentTime={currentTime}
          mediaRevision={selectedRevision}
          canManage={!shared && video.canManage !== false}
          ready={video.status === "READY"}
          onSeek={(time, revision) => {
            if (revision !== undefined && revision !== selectedRevision) {
              const version = revisions.find((v) => v.revision === revision);
              if (version) {
                pendingSeek.current = time;
                setSelectedRevision(revision);
                setPlaybackUrl(version.playbackUrl);
              }
            } else if (player.current) {
              player.current.currentTime = time;
              void player.current.play().catch(() => {});
            }
          }}
        />
      </div>
      {dialog === "share" && (
        <Dialog title="Share this clip" onClose={() => setDialog(null)}>
          <p>Creating a new link revokes the previous link.</p>
          {actionError && <ErrorNotice>{actionError}</ErrorNotice>}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void share();
            }}
          >
            <label className="field-label" htmlFor="link-password">
              Password (optional)
            </label>
            <input
              id="link-password"
              type="password"
              autoComplete="new-password"
              value={linkPassword}
              onChange={(event) => setLinkPassword(event.target.value)}
              minLength={8}
              maxLength={72}
              placeholder="At least 8 characters"
            />
            <label className="field-label" htmlFor="link-expiry">
              Expires at (optional)
            </label>
            <input
              id="link-expiry"
              type="datetime-local"
              value={linkExpiry}
              onChange={(event) => setLinkExpiry(event.target.value)}
            />
            <div className="dialog-actions">
              <button className="button button-dark" disabled={pending}>
                Create share link
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {dialog === "rename" && (
        <Dialog title="Give it a new name." onClose={() => setDialog(null)}>
          {actionError && <ErrorNotice>{actionError}</ErrorNotice>}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const title = String(
                new FormData(event.currentTarget).get("title"),
              ).trim();
              if (!title) return;
              void action(async () => {
                await api(`/api/videos/${id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ title }),
                });
                setVideo({ ...video, title });
                setDialog(null);
              });
            }}
          >
            <p>A clear name makes your clip easier to find.</p>
            <label className="field-label" htmlFor="rename-title">
              Video title
            </label>
            <input
              id="rename-title"
              name="title"
              required
              maxLength={200}
              defaultValue={video.title}
              autoFocus
            />
            <div className="dialog-actions">
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setDialog(null)}
                disabled={pending}
              >
                Cancel
              </button>
              <button className="button button-dark" disabled={pending}>
                Save name
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {dialog === "delete" && (
        <Dialog title="Delete this clip?" onClose={() => setDialog(null)}>
          {actionError && <ErrorNotice>{actionError}</ErrorNotice>}
          <p>
            This removes the recording, its comments, and viewing insights.
            Anyone with the share link will lose access. This can’t be undone.
          </p>
          <div className="dialog-actions">
            <button
              className="button button-ghost"
              onClick={() => setDialog(null)}
              disabled={pending}
            >
              Keep clip
            </button>
            <button
              className="button button-danger"
              disabled={pending}
              onClick={() =>
                action(async () => {
                  await api(`/api/videos/${id}`, { method: "DELETE" });
                  router.push("/dashboard");
                })
              }
            >
              <Trash2 size={15} /> Delete clip
            </button>
          </div>
        </Dialog>
      )}
    </main>
  );
}
