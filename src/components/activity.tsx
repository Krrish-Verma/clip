"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { api, cloudConfigured } from "@/lib/api";
import { errorMessage, type Notification } from "@/lib/types";
import { useSession } from "./session-provider";
import { Dialog } from "./dialog";
import { ErrorNotice } from "./ui";

export function Activity() {
  const { user } = useSession();
  const [items, setItems] = useState<Notification[]>([]),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!user || !cloudConfigured) return;
    try {
      setItems(await api<Notification[]>("/api/notifications"));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), 30000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [load]);
  if (!user) return null;
  const unread = items.filter((n) => !n.read).length;
  return (
    <>
      <button
        className="icon-button activity-button"
        aria-label={`Activity${unread ? `, ${unread} unread` : ""}`}
        onClick={() => {
          setOpen(true);
          setLoading(cloudConfigured);
          void load();
        }}
      >
        <Bell size={19} />
        {unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <Dialog title="Your activity" onClose={() => setOpen(false)}>
          <p>Comments, replies, mentions, and reactions—all in one place.</p>
          {error && <ErrorNotice>{error}</ErrorNotice>}
          {unread > 0 && (
            <button
              className="inline-button"
              onClick={async () => {
                try {
                  await api("/api/notifications/read", { method: "POST" });
                  await load();
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            >
              <CheckCheck size={15} /> Mark all as read
            </button>
          )}
          <div className="activity-list">
            {loading && !items.length ? (
              <p>Loading activity…</p>
            ) : items.length ? (
              items.map((item) => (
                <article
                  key={item.id}
                  className={`activity-item ${item.read ? "" : "unread"}`}
                >
                  <span className="activity-dot" />
                  <div>
                    <small>{new Date(item.createdAt).toLocaleString()}</small>
                    <p>{item.message}</p>
                    {item.canOpen ? (
                      <Link
                        onClick={() => setOpen(false)}
                        href={`/videos/${item.videoId}`}
                      >
                        {item.videoTitle} ↗
                      </Link>
                    ) : (
                      <span className="activity-context">
                        {item.videoTitle} · Open the original share link to
                        reply.
                      </span>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="activity-empty">
                <Bell size={30} />
                <h3>You’re all caught up.</h3>
                <p>Activity appears when someone joins the conversation.</p>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
