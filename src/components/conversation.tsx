"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  CheckCheck,
  Clock3,
  MessageCircle,
  Pencil,
  Reply,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  duration,
  errorMessage,
  type Comment,
  type Participant,
  type Reaction,
} from "@/lib/types";
import { useSession } from "./session-provider";
import { ErrorNotice } from "./ui";
import { Dialog } from "./dialog";

export function Conversation({
  videoId,
  shareToken,
  currentTime,
  ready,
  onSeek,
}: {
  videoId: string;
  shareToken?: string;
  currentTime: number;
  ready: boolean;
  onSeek: (time: number) => void;
}) {
  const { user } = useSession();
  const [comments, setComments] = useState<Comment[]>([]),
    [reactions, setReactions] = useState<Reaction[]>([]),
    [people, setPeople] = useState<Participant[]>([]);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(""),
    [name, setName] = useState(""),
    [timestamp, setTimestamp] = useState(0);
  const [reply, setReply] = useState<Comment | null>(null),
    [editing, setEditing] = useState<Comment | null>(null),
    [deleting, setDeleting] = useState<Comment | null>(null);
  const [mentions, setMentions] = useState<string[]>([]),
    [showResolved, setShowResolved] = useState(false);
  const query = shareToken
    ? `?shareToken=${encodeURIComponent(shareToken)}`
    : "";
  const base = `/api/videos/${videoId}`;
  const load = useCallback(async () => {
    if (!ready) return;
    try {
      const [messages, emoji, participants] = await Promise.all([
        api<Comment[]>(`${base}/comments${query}`),
        api<Reaction[]>(`${base}/reactions${query}`),
        api<Participant[]>(`${base}/participants${query}`),
      ]);
      setComments(messages);
      setReactions(emoji);
      setPeople(participants);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [base, query, ready]);
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 15000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [load]);
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
  function reset() {
    setMessage("");
    setReply(null);
    setEditing(null);
    setMentions([]);
  }
  const roots = comments.filter((c) => !c.parentId),
    resolved = roots.filter((c) => c.resolved).length;
  function commentCard(item: Comment, isReply = false) {
    return (
      <article
        className={`comment ${isReply ? "comment-reply" : ""}`}
        key={item.id}
      >
        <div className="comment-author">
          <span className="avatar">
            {item.displayName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{item.displayName}</strong>
            <small>
              {new Date(item.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
              {item.editedAt ? " · edited" : ""}
            </small>
          </div>
          {item.resolved && (
            <span className="resolved-label">
              <CheckCheck size={14} /> Resolved
            </span>
          )}
        </div>
        <p>
          <button
            className="timestamp"
            onClick={() => onSeek(item.timestampSeconds)}
          >
            {duration(item.timestampSeconds)}
          </button>
          {item.message}
        </p>
        <div className="comment-tools">
          {!isReply && (
            <button
              onClick={() => {
                reset();
                setReply(item);
                setTimestamp(item.timestampSeconds);
              }}
            >
              {" "}
              <Reply size={13} /> Reply
            </button>
          )}
          {!shareToken && !isReply && (
            <button
              disabled={busy}
              onClick={() =>
                void perform(() =>
                  api(`${base}/comments/${item.id}/resolution`, {
                    method: "PATCH",
                    body: JSON.stringify({ resolved: !item.resolved }),
                  }),
                )
              }
            >
              <Check size={13} />
              {item.resolved ? "Reopen" : "Resolve"}
            </button>
          )}
          {user?.id === item.authorId && (
            <button
              onClick={() => {
                reset();
                setEditing(item);
                setMessage(item.message);
              }}
              aria-label={`Edit comment by ${item.displayName}`}
            >
              <Pencil size={13} /> Edit
            </button>
          )}
          {user && (!shareToken || user.id === item.authorId) && (
            <button
              onClick={() => setDeleting(item)}
              aria-label={`Delete comment by ${item.displayName}`}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </article>
    );
  }
  return (
    <aside className="comment-panel conversation-panel">
      <div className="reaction-bar" aria-label="Video reactions">
        {["👍", "❤️", "🎉", "👀", "💡"].map((emoji) => {
          const reaction = reactions.find((r) => r.emoji === emoji);
          return (
            <button
              key={emoji}
              aria-label={`${emoji} reaction${reaction?.mine ? ", selected" : ""}`}
              aria-pressed={reaction?.mine || false}
              title={user ? "React at the current moment" : "Sign in to react"}
              disabled={!user || !ready || busy}
              onClick={() =>
                void perform(() =>
                  api(`${base}/reactions${query}`, {
                    method: "POST",
                    body: JSON.stringify({
                      emoji,
                      timestampSeconds: Math.floor(currentTime),
                    }),
                  }),
                )
              }
            >
              {emoji}
              <small>{reaction?.count || 0}</small>
            </button>
          );
        })}
      </div>
      <h2 className="comment-heading">
        <MessageCircle size={17} /> Conversation <span>{comments.length}</span>
      </h2>
      {resolved > 0 && (
        <button
          className="resolved-filter"
          aria-pressed={showResolved}
          onClick={() => setShowResolved(!showResolved)}
        >
          {showResolved ? "Hide" : "Show"} {resolved} resolved{" "}
          {resolved === 1 ? "thread" : "threads"}
        </button>
      )}
      {error && (
        <ErrorNotice>
          {error}{" "}
          <button className="inline-button" onClick={() => void load()}>
            Retry
          </button>
        </ErrorNotice>
      )}
      <div className="comment-list">
        {loading ? (
          <p className="conversation-hint">Loading conversation…</p>
        ) : roots.filter((c) => showResolved || !c.resolved).length ? (
          roots
            .filter((c) => showResolved || !c.resolved)
            .map((root) => (
              <div className="comment-thread" key={root.id}>
                {commentCard(root)}
                {comments
                  .filter((c) => c.parentId === root.id)
                  .map((c) => commentCard(c, true))}
              </div>
            ))
        ) : (
          <div className="comment-empty">
            <MessageCircle size={28} />
            <h3>
              {resolved ? "All caught up." : "Keep the conversation here."}
            </h3>
            <p>
              Ask a question or leave feedback
              <br />
              at the exact moment that matters.
            </p>
          </div>
        )}
      </div>
      <form
        className="comment-form"
        onSubmit={(event) => {
          event.preventDefault();
          void perform(async () => {
            if (editing) {
              await api(`${base}/comments/${editing.id}${query}`, {
                method: "PATCH",
                body: JSON.stringify({ message: message.trim() }),
              });
            } else {
              await api(`${base}/comments${query}`, {
                method: "POST",
                body: JSON.stringify({
                  message: message.trim(),
                  timestampSeconds: Math.floor(timestamp),
                  guestDisplayName: user ? undefined : name.trim(),
                  parentId: reply?.id,
                  mentionIds: mentions,
                }),
              });
            }
            reset();
          });
        }}
      >
        {(reply || editing) && (
          <div className="reply-banner">
            <span>
              {editing
                ? "Editing comment"
                : `Replying to ${reply?.displayName}`}
            </span>
            <button
              type="button"
              aria-label="Cancel reply or edit"
              onClick={reset}
            >
              <X size={14} />
            </button>
          </div>
        )}
        {!user && (
          <label>
            Your name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              placeholder="Your name"
              autoComplete="name"
            />
          </label>
        )}
        <label className="sr-only" htmlFor="conversation-message">
          Comment
        </label>
        <textarea
          id="conversation-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onFocus={() => {
            if (!message && !reply && !editing) setTimestamp(currentTime);
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          required
          maxLength={1000}
          disabled={!ready || busy}
          placeholder={
            reply ? "Write a reply…" : "Share a thought at this moment…"
          }
        />
        {user && !editing && people.some((p) => p.clerkUserId !== user.id) && (
          <label className="mention-picker">
            Mention a participant
            <select
              aria-label="Mention a participant"
              value=""
              onChange={(e) => {
                const person = people.find((p) => p.id === e.target.value);
                if (person) {
                  setMessage(
                    (m) => `${m}${m ? " " : ""}@${person.displayName} `,
                  );
                  setMentions((m) => Array.from(new Set([...m, person.id])));
                }
              }}
            >
              <option value="">Choose someone…</option>
              {people
                .filter((p) => p.clerkUserId !== user.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
            </select>
          </label>
        )}
        <div className="comment-form-actions">
          <button
            className="comment-time"
            type="button"
            onClick={() => setTimestamp(currentTime)}
            disabled={!!editing || !!reply}
          >
            <Clock3 size={13} />
            {duration(timestamp)}
          </button>
          <button
            className="button button-dark"
            disabled={
              busy || !ready || !message.trim() || (!user && !name.trim())
            }
          >
            <Send size={13} />
            {editing ? "Save" : "Send"}
          </button>
        </div>
      </form>
      {deleting && (
        <Dialog title="Delete this comment?" onClose={() => setDeleting(null)}>
          <p>Replies to this comment will also be removed.</p>
          <div className="dialog-actions">
            <button
              className="button button-outline"
              onClick={() => setDeleting(null)}
            >
              Cancel
            </button>
            <button
              className="button button-danger"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  await api(`${base}/comments/${deleting.id}${query}`, {
                    method: "DELETE",
                  });
                  setDeleting(null);
                  reset();
                })
              }
            >
              Delete comment
            </button>
          </div>
        </Dialog>
      )}
    </aside>
  );
}
