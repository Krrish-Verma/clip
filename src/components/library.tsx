"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  ArrowUpRight,
  Eye,
  Film,
  Grid2X2,
  List,
  LoaderCircle,
  LockKeyhole,
  MonitorPlay,
  Plus,
  Search,
  Video,
  X,
} from "lucide-react";
import { api, cloudConfigured } from "@/lib/api";
import { duration, errorMessage, type ClipVideo } from "@/lib/types";
import { useSession } from "./session-provider";
import { ErrorNotice, Loading } from "./ui";

export function Library() {
  const session = useSession();
  return (
    <LibraryContent key={session.user?.id || "anonymous"} session={session} />
  );
}

function LibraryContent({
  session,
}: {
  session: ReturnType<typeof useSession>;
}) {
  const { user, loading: sessionLoading } = session;
  const [videos, setVideos] = useState<ClipVideo[]>([]);
  const [loading, setLoading] = useState(cloudConfigured);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("All videos");
  const [query, setQuery] = useState("");
  const [list, setList] = useState(false);
  const [sort, setSort] = useState("newest");
  const load = useCallback(() => {
    if (!user || !cloudConfigured) return;
    return api<ClipVideo[]>("/api/videos")
      .then((data) => {
        setVideos(data);
        setError("");
      })
      .catch((error) => setError(errorMessage(error)))
      .finally(() => setLoading(false));
  }, [user]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (
      !videos.some(
        (video) =>
          video.status === "PROCESSING" || video.status === "UPLOADING",
      )
    )
      return;
    const timer = setInterval(() => {
      void load();
    }, 8000);
    return () => clearInterval(timer);
  }, [videos, load]);
  const filtered = useMemo(
    () =>
      videos
        .filter(
          (video) =>
            video.title.toLowerCase().includes(query.toLowerCase()) &&
            (filter === "All videos" ||
              (filter === "Shared" && video.visibility === "UNLISTED") ||
              (filter === "Private" && video.visibility === "PRIVATE")),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.title.localeCompare(b.title)
            : (Date.parse(b.createdAt) - Date.parse(a.createdAt)) *
              (sort === "oldest" ? -1 : 1),
        ),
    [videos, filter, query, sort],
  );
  const hasQuery = query || filter !== "All videos";

  return (
    <main id="main" className="app-main library-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR IDEAS, ALL TOGETHER</span>
          <h1>
            My library<span className="heading-period">.</span>
          </h1>
          <p>Every walkthrough. Every lightbulb moment. Right here.</p>
        </div>
        <Link href="/record" className="button button-dark">
          <Plus size={18} /> Record a video
        </Link>
      </div>
      <div className="library-toolbar">
        <div
          className="library-tabs"
          role="group"
          aria-label="Video visibility"
        >
          {["All videos", "Shared", "Private"].map((tab) => (
            <button
              key={tab}
              aria-pressed={filter === tab}
              className={filter === tab ? "selected" : ""}
              onClick={() => setFilter(tab)}
            >
              {tab}
              {tab === "All videos" && user && <span>{videos.length}</span>}
            </button>
          ))}
        </div>
        <div className="search-field">
          <Search size={18} />
          <input
            aria-label="Search your videos"
            placeholder="Search your videos"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="library-subtoolbar">
        <span>
          {user
            ? `${videos.length} of 5 video spaces used`
            : "A space for your best explanations"}
        </span>
        <div className="library-display">
          <label className="sort-control">
            <ArrowDownWideNarrow size={16} />
            <select
              aria-label="Sort videos"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
          <span className="toolbar-divider" />
          <div className="view-switch">
            <button
              aria-label="Grid view"
              aria-pressed={!list}
              className={!list ? "selected" : ""}
              onClick={() => setList(false)}
            >
              <Grid2X2 size={17} />
            </button>
            <button
              aria-label="List view"
              aria-pressed={list}
              className={list ? "selected" : ""}
              onClick={() => setList(true)}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>
      {error && (
        <ErrorNotice>
          {error}{" "}
          <button className="inline-button" onClick={load}>
            Try again
          </button>
        </ErrorNotice>
      )}
      {sessionLoading || (user && loading && !videos.length) ? (
        <Loading text="Finding your clips…" />
      ) : filtered.length ? (
        <div className={list ? "video-list" : "video-grid"}>
          {filtered.map((video) => (
            <article className="video-card" key={video.id}>
              <Link href={`/videos/${video.id}`} className="video-card-image">
                {video.thumbnailUrl ? (
                  <Image
                    src={video.thumbnailUrl}
                    alt=""
                    fill
                    unoptimized
                    sizes="(max-width: 700px) 100vw, 33vw"
                  />
                ) : (
                  <Film size={34} strokeWidth={1.3} />
                )}
                <span className="duration-badge">
                  {duration(video.durationSeconds)}
                </span>
                {video.status !== "READY" && (
                  <span
                    className={`video-state-badge state-${video.status.toLowerCase()}`}
                  >
                    {video.status === "PROCESSING" && (
                      <LoaderCircle size={14} className="spin" />
                    )}
                    {video.status === "FAILED"
                      ? "Processing failed"
                      : video.status === "UPLOADING"
                        ? "Uploading"
                        : "Processing"}
                  </span>
                )}
              </Link>
              <div className="video-card-details">
                <Link href={`/videos/${video.id}`}>
                  <h2>{video.title}</h2>
                </Link>
                <div className="video-card-meta">
                  <span>
                    {new Date(video.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span>
                    <Eye size={14} />
                    {video.views}
                  </span>
                  <span>
                    <LockKeyhole size={13} />
                    {video.visibility === "PRIVATE" ? "Private" : "Unlisted"}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="library-empty">
          <div className="empty-icon">
            <MonitorPlay size={36} strokeWidth={1.4} />
          </div>
          <h2>
            {hasQuery
              ? "No clips found."
              : "Your next great explanation starts here."}
          </h2>
          <p>
            {hasQuery
              ? "Try another search or filter to find your clip."
              : "Turn a quick thought into a clear walkthrough.\nRecord your first clip and make yourself understood."}
          </p>
          {hasQuery ? (
            <button
              className="button button-outline"
              onClick={() => {
                setQuery("");
                setFilter("All videos");
              }}
            >
              Clear filters
            </button>
          ) : (
            <Link href="/record" className="button button-dark">
              <span className="record-dot" /> Create your first clip{" "}
              <ArrowUpRight size={17} />
            </Link>
          )}
          {!user && !hasQuery && (
            <span className="empty-signin">
              Already have some clips?{" "}
              <Link href="/login">
                Log in <ArrowRight size={13} />
              </Link>
            </span>
          )}
        </div>
      )}
      {!cloudConfigured && (
        <div className="cloud-notice">
          <div>
            <LockKeyhole size={20} />
            <div>
              <strong>Your cloud library is coming next.</strong>
              <p>
                You can record and download clips now. Accounts, uploads, and
                sharing need a connected backend.
              </p>
            </div>
          </div>
          <Link href="/record">
            Open recorder <ArrowUpRight size={16} />
          </Link>
        </div>
      )}
      <div className="library-bottom-note">
        <Video size={16} />
        <span>A little video. A lot more clarity.</span>
      </div>
    </main>
  );
}
