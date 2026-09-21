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
  MessageCircle,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  VideoOff,
} from "lucide-react";
import { api, cloudConfigured } from "@/lib/api";
import {
  duration,
  errorMessage,
  type ClipVideo,
  type Comment,
} from "@/lib/types";
import { useSession } from "./session-provider";
import { Dialog } from "./dialog";
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
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [guestName, setGuestName] = useState("");
  const [commentTime, setCommentTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const player = useRef<HTMLVideoElement>(null);
  const sessionId = useRef<string | null>(null);
  const starting = useRef(false);
  const tracked = useRef(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accessQuery = shareToken
    ? `?shareToken=${encodeURIComponent(shareToken)}`
    : "";
  const id = video?.id || videoId;

  const load = useCallback(() => {
    const request = shareToken
      ? api<SharedVideo>(`/api/shares/${encodeURIComponent(shareToken)}`).then(
          async (data) => {
            const messages = await api<Comment[]>(
              `/api/videos/${data.id}/comments?shareToken=${encodeURIComponent(shareToken)}`,
            );
            return {
              video: data,
              playbackUrl: data.playbackUrl,
              comments: messages,
            };
          },
        )
      : api<ClipVideo>(`/api/videos/${videoId}`).then(async (data) => {
          if (data.status !== "READY")
            return { video: data, playbackUrl: "", comments: [] };
          const [playback, messages] = await Promise.all([
            api<{ playbackUrl: string }>(`/api/videos/${videoId}/playback`),
            api<Comment[]>(`/api/videos/${videoId}/comments`),
          ]);
          return {
            video: data,
            playbackUrl: playback.playbackUrl,
            comments: messages,
          };
        });
    return request
      .then((result) => {
        setVideo(result.video);
        setPlaybackUrl(result.playbackUrl);
        setComments(result.comments);
        setError("");
      })
      .catch((error) => setError(errorMessage(error)))
      .finally(() => setLoading(false));
  }, [videoId, shareToken]);
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
    [id, accessQuery],
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
        { method: "POST" },
      );
      setShareUrl(result.shareUrl);
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
  async function comment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await action(async () => {
      const created = await api<Comment>(
        `/api/videos/${id}/comments${accessQuery}`,
        {
          method: "POST",
          body: JSON.stringify({
            message: message.trim(),
            timestampSeconds: Math.floor(commentTime),
            ...(!user ? { guestDisplayName: guestName.trim() } : {}),
          }),
        },
      );
      setComments((previous) => [...previous, created]);
      setMessage("");
    });
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
        {!shared && (
          <div className="video-actions">
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
              onClick={share}
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
          <p>Anyone with this link can watch and leave a comment.</p>
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
              onError={() =>
                setActionError(
                  "This video couldn’t be played. Refresh the page to request a new playback link.",
                )
              }
            />
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
        </div>
        <aside className="comment-panel">
          <h2 className="comment-heading">
            <MessageCircle size={16} /> Conversation
            <span>{comments.length}</span>
          </h2>
          <div className="comment-list">
            {comments.length ? (
              comments.map((item) => (
                <article className="comment" key={item.id}>
                  <div className="comment-author">
                    <span className="avatar">
                      {item.displayName.slice(0, 1).toUpperCase()}
                    </span>
                    {item.displayName}
                  </div>
                  <p>
                    <button
                      className="timestamp"
                      aria-label={`Seek to ${duration(item.timestampSeconds)}`}
                      onClick={() => {
                        if (player.current) {
                          player.current.currentTime = item.timestampSeconds;
                          void player.current.play().catch(() => {});
                        }
                      }}
                    >
                      {duration(item.timestampSeconds)}
                    </button>
                    {item.message}
                  </p>
                </article>
              ))
            ) : (
              <div className="comment-empty">
                <MessageCircle size={27} strokeWidth={1.3} />
                <h3>A good place to start a conversation.</h3>
                <p>
                  Leave a thought at the exact moment
                  <br />
                  you want to talk about.
                </p>
              </div>
            )}
          </div>
          <form onSubmit={comment} className="comment-form">
            {!user && (
              <label>
                Your name
                <input
                  required
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Let them know it’s you"
                />
              </label>
            )}
            <label className="sr-only" htmlFor="comment-message">
              Your comment
            </label>
            <textarea
              id="comment-message"
              required
              maxLength={1000}
              value={message}
              onFocus={() => {
                if (!message) setCommentTime(currentTime);
              }}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Add a thought, a question, a little clarity…"
              disabled={video.status !== "READY"}
            />
            <div className="comment-form-actions">
              <button
                className="comment-time"
                type="button"
                onClick={() => setCommentTime(currentTime)}
                aria-label="Comment at current time"
              >
                <Clock3 size={13} />
                {duration(commentTime)}
              </button>
              <button
                className="button button-dark"
                disabled={
                  pending ||
                  !message.trim() ||
                  (!user && !guestName.trim()) ||
                  video.status !== "READY"
                }
              >
                <Send size={12} /> Send
              </button>
            </div>
          </form>
        </aside>
      </div>
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
