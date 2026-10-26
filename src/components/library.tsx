"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowUpRight,
  Check,
  Eye,
  Film,
  Folder as FolderIcon,
  Grid2X2,
  LibraryBig,
  List,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Search,
  Star,
  Video,
  X,
} from "lucide-react";
import { api, cloudConfigured } from "@/lib/api";
import {
  duration,
  errorMessage,
  type ClipVideo,
  type Folder,
} from "@/lib/types";
import { useSession } from "./session-provider";
import { Dialog } from "./dialog";
import { ErrorNotice } from "./ui";

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
  const [videos, setVideos] = useState<ClipVideo[]>([]),
    [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(cloudConfigured),
    [error, setError] = useState("");
  const [section, setSection] = useState("all"),
    [visibility, setVisibility] = useState("all"),
    [query, setQuery] = useState("");
  const [list, setList] = useState(false),
    [sort, setSort] = useState("newest"),
    [folderName, setFolderName] = useState("");
  const [dialog, setDialog] = useState<"folder" | "delete-folder" | null>(null),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1);
  const load = useCallback(async () => {
    if (!session.user || !cloudConfigured) return;
    try {
      const [clips, groups] = await Promise.all([
        api<ClipVideo[]>("/api/videos"),
        api<Folder[]>("/api/folders"),
      ]);
      setVideos(clips);
      setFolders(groups);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [session.user]);
  useEffect(() => {
    const initial = setTimeout(() => void load(), 0);
    return () => clearTimeout(initial);
  }, [load]);
  useEffect(() => {
    if (!videos.some((v) => ["PROCESSING", "UPLOADING"].includes(v.status)))
      return;
    const timer = setInterval(() => void load(), 8000);
    return () => clearInterval(timer);
  }, [videos, load]);
  const currentFolder = folders.find((f) => f.id === section),
    active = videos.filter((v) => !v.archived);
  const filtered = useMemo(
    () =>
      videos
        .filter(
          (v) =>
            (section === "archive" ? v.archived : !v.archived) &&
            (section !== "favorites" || v.favorite) &&
            (["all", "favorites", "archive"].includes(section) ||
              v.folderId === section) &&
            v.title.toLowerCase().includes(query.toLowerCase()) &&
            (visibility === "all" || v.visibility === visibility),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.title.localeCompare(b.title)
            : sort === "views"
              ? b.views - a.views
              : (Date.parse(b.createdAt) - Date.parse(a.createdAt)) *
                (sort === "oldest" ? -1 : 1),
        ),
    [videos, section, query, visibility, sort],
  );
  async function mutate(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
      setDialog(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function organize(video: ClipVideo, changes: Partial<ClipVideo>) {
    return mutate(() =>
      api(`/api/videos/${video.id}/organization`, {
        method: "PATCH",
        body: JSON.stringify({
          folderId: video.folderId || null,
          favorite: video.favorite,
          archived: video.archived,
          ...changes,
        }),
      }),
    );
  }
  function select(value: string) {
    setSection(value);
    setPage(1);
  }
  const title =
    currentFolder?.name ||
    (section === "favorites"
      ? "Favorites"
      : section === "archive"
        ? "Archive"
        : "My library");
  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar" aria-label="Library navigation">
        <div className="workspace-label">
          <span className="workspace-monogram">C</span>
          <div>
            <strong>Your workspace</strong>
            <small>Personal library</small>
          </div>
        </div>
        <Link className="button button-dark sidebar-record" href="/record">
          <Plus size={17} /> Record a clip
        </Link>
        <span className="sidebar-label">WORKSPACE</span>
        {[
          {
            id: "all",
            label: "All videos",
            icon: LibraryBig,
            count: active.length,
          },
          {
            id: "favorites",
            label: "Favorites",
            icon: Star,
            count: active.filter((v) => v.favorite).length,
          },
          {
            id: "archive",
            label: "Archive",
            icon: Archive,
            count: videos.filter((v) => v.archived).length,
          },
        ].map((item) => (
          <button
            key={item.id}
            className={`sidebar-link ${section === item.id ? "selected" : ""}`}
            onClick={() => select(item.id)}
          >
            <item.icon size={18} />
            {item.label}
            <span>{item.count}</span>
          </button>
        ))}
        <div className="sidebar-label-row">
          <span className="sidebar-label">FOLDERS</span>
          <button
            className="icon-button"
            aria-label="Create folder"
            disabled={!session.user || !cloudConfigured}
            onClick={() => {
              setFolderName("");
              setDialog("folder");
            }}
          >
            <Plus size={15} />
          </button>
        </div>
        {folders.map((folder) => (
          <button
            key={folder.id}
            className={`sidebar-link ${section === folder.id ? "selected" : ""}`}
            onClick={() => select(folder.id)}
          >
            <FolderIcon size={17} />
            <span className="folder-name">{folder.name}</span>
            <span>{active.filter((v) => v.folderId === folder.id).length}</span>
          </button>
        ))}
        {!folders.length && (
          <p className="sidebar-hint">
            A place for every project.
            <br />
            Create a folder to get organized.
          </p>
        )}
        <div className="sidebar-storage">
          <Video size={17} />
          <strong>{videos.length} / 5 clips</strong>
          <div className="quota-meter">
            <span
              style={{ width: `${Math.min(100, (videos.length / 5) * 100)}%` }}
            />
          </div>
          <small>Archive keeps clips in your quota.</small>
        </div>
      </aside>
      <main id="main" className="app-main library-page workspace-main">
        <div className="workspace-breadcrumb">
          Workspace <span>/</span> {title}
        </div>
        <div className="page-heading">
          <div>
            <span className="eyebrow">LESS MEETING. MORE MEANING.</span>
            <h1>
              {title}
              <span className="heading-period">.</span>
            </h1>
            <p>
              {section === "archive"
                ? "Saved for later. Restore a clip whenever you need it."
                : "Your thinking, ready to share. Keep the next conversation moving."}
            </p>
          </div>
          <div className="heading-actions">
            <button
              className="button button-outline"
              disabled={!session.user || !cloudConfigured}
              onClick={() => {
                setFolderName("");
                setDialog("folder");
              }}
            >
              <FolderIcon size={16} /> New folder
            </button>
            {currentFolder && (
              <button
                className="button button-outline"
                onClick={() => setDialog("delete-folder")}
              >
                Remove folder
              </button>
            )}
            <Link href="/record" className="button button-dark">
              <Plus size={17} /> New recording
            </Link>
          </div>
        </div>
        {section === "all" && (
          <div className="library-overview">
            {[
              {
                icon: Film,
                value: active.length,
                label: "Clips in your library",
              },
              {
                icon: ArrowUpRight,
                value: active.filter((v) => v.visibility === "UNLISTED").length,
                label: "Shared conversations",
              },
              {
                icon: Eye,
                value: videos.reduce((n, v) => n + v.views, 0),
                label: "Total views",
              },
            ].map((item) => (
              <div key={item.label}>
                <span className="overview-icon">
                  <item.icon size={20} />
                </span>
                <div>
                  <strong>{item.value}</strong>
                  <small>{item.label}</small>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="library-toolbar">
          <div
            className="library-tabs"
            role="group"
            aria-label="Visibility filter"
          >
            {[
              { value: "all", label: "All clips" },
              { value: "PRIVATE", label: "Private" },
              { value: "UNLISTED", label: "Shared" },
            ].map((tab) => (
              <button
                key={tab.value}
                aria-pressed={visibility === tab.value}
                className={visibility === tab.value ? "selected" : ""}
                onClick={() => {
                  setVisibility(tab.value);
                  setPage(1);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="search-field">
            <Search size={17} />
            <input
              aria-label="Search videos"
              placeholder="Search this library…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
            {query && (
              <button aria-label="Clear search" onClick={() => setQuery("")}>
                <X size={15} />
              </button>
            )}
          </div>
        </div>
        <div className="library-subtoolbar">
          <span>{filtered.length} clips</span>
          <div className="library-display">
            <select
              aria-label="Sort videos"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name">Name A–Z</option>
              <option value="views">Most viewed</option>
            </select>
            <div className="view-switch">
              <button
                aria-label="Grid view"
                aria-pressed={!list}
                onClick={() => setList(false)}
              >
                <Grid2X2 size={17} />
              </button>
              <button
                aria-label="List view"
                aria-pressed={list}
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
            <button className="inline-button" onClick={() => void load()}>
              Retry
            </button>
          </ErrorNotice>
        )}
        {session.loading || (session.user && loading) ? (
          <div
            className="video-grid"
            aria-label="Loading library"
            aria-busy="true"
          >
            {[1, 2, 3].map((n) => (
              <div className="video-skeleton" key={n}>
                <div />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : filtered.length ? (
          <>
            <div className={list ? "video-list" : "video-grid"}>
              {filtered.slice((page - 1) * 12, page * 12).map((video) => (
                <article className="video-card" key={video.id}>
                  <Link
                    href={`/videos/${video.id}`}
                    className="video-card-image"
                  >
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
                          <LoaderCircle className="spin" size={14} />
                        )}{" "}
                        {video.status === "FAILED"
                          ? "Needs attention"
                          : video.status === "PROCESSING"
                            ? "Processing"
                            : "Uploading"}
                      </span>
                    )}
                  </Link>
                  <div className="video-card-details">
                    <Link href={`/videos/${video.id}`}>
                      <h2>{video.title}</h2>
                    </Link>
                    <div className="video-card-meta">
                      <span>
                        {new Date(video.createdAt).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric" },
                        )}
                      </span>
                      <span>
                        <Eye size={13} />
                        {video.views}
                      </span>
                      <span>
                        <LockKeyhole size={12} />
                        {video.visibility === "PRIVATE"
                          ? "Private"
                          : "Unlisted"}
                      </span>
                    </div>
                    <div className="card-organization">
                      <select
                        aria-label={`Move ${video.title} to folder`}
                        value={video.folderId || ""}
                        disabled={busy}
                        onChange={(e) =>
                          void organize(video, {
                            folderId: e.target.value || null,
                          })
                        }
                      >
                        <option value="">No folder</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className={`icon-button ${video.favorite ? "is-favorite" : ""}`}
                        aria-label={`${video.favorite ? "Unfavorite" : "Favorite"} ${video.title}`}
                        aria-pressed={video.favorite}
                        disabled={busy}
                        onClick={() =>
                          void organize(video, { favorite: !video.favorite })
                        }
                      >
                        <Star
                          size={16}
                          fill={video.favorite ? "currentColor" : "none"}
                        />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`${video.archived ? "Restore" : "Archive"} ${video.title}`}
                        disabled={busy}
                        onClick={() =>
                          void organize(video, { archived: !video.archived })
                        }
                      >
                        {video.archived ? (
                          <Check size={16} />
                        ) : (
                          <Archive size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {filtered.length > 12 && (
              <div className="pagination">
                <button
                  className="button button-outline"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {Math.ceil(filtered.length / 12)}
                </span>
                <button
                  className="button button-outline"
                  disabled={page * 12 >= filtered.length}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="library-empty">
            <div className="empty-icon">
              {currentFolder ? (
                <FolderIcon size={35} />
              ) : section === "favorites" ? (
                <Star size={35} />
              ) : (
                <Film size={35} />
              )}
            </div>
            <h2>
              {query
                ? "No matching clips."
                : section === "favorites"
                  ? "Keep your best thinking close."
                  : section === "archive"
                    ? "Nothing in the archive."
                    : currentFolder
                      ? "A fresh start for this project."
                      : "Your next idea deserves a clip."}
            </h2>
            <p>
              {query
                ? "Try another title or clear your filters."
                : currentFolder
                  ? "Move a clip here using the folder menu on any video card."
                  : section === "favorites"
                    ? "Star a clip in your library to find it here."
                    : "Record a walkthrough, share an update, or explain that one tricky thing."}
            </p>
            <Link href="/record" className="button button-dark">
              <Plus size={16} /> Record a clip
            </Link>
          </div>
        )}
        {!cloudConfigured && (
          <div className="cloud-notice">
            <div>
              <LockKeyhole size={20} />
              <div>
                <strong>Your recordings stay with you.</strong>
                <p>
                  Record, preview, and download locally. Cloud saving is not
                  connected on this deployment yet.
                </p>
              </div>
            </div>
            <Link href="/record">
              Open recorder <ArrowUpRight size={16} />
            </Link>
          </div>
        )}
        {dialog && (
          <Dialog
            title={
              dialog === "folder"
                ? "A home for your project."
                : "Remove this folder?"
            }
            onClose={() => setDialog(null)}
          >
            {error && <ErrorNotice>{error}</ErrorNotice>}
            {dialog === "folder" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate(() =>
                    api("/api/folders", {
                      method: "POST",
                      body: JSON.stringify({ name: folderName.trim() }),
                    }),
                  );
                }}
              >
                <label className="field-label" htmlFor="folder-name">
                  Folder name
                </label>
                <input
                  id="folder-name"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  required
                  maxLength={80}
                  autoFocus
                  placeholder="e.g. Product walkthroughs"
                />
                <div className="dialog-actions">
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => setDialog(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="button button-dark"
                    disabled={busy || !folderName.trim()}
                  >
                    Create folder
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p>
                  Your videos will stay in your library. Only the folder is
                  removed.
                </p>
                <div className="dialog-actions">
                  <button
                    className="button button-outline"
                    onClick={() => setDialog(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="button button-danger"
                    disabled={busy}
                    onClick={() =>
                      void mutate(async () => {
                        await api(`/api/folders/${section}`, {
                          method: "DELETE",
                        });
                        select("all");
                      })
                    }
                  >
                    Remove folder
                  </button>
                </div>
              </>
            )}
          </Dialog>
        )}
      </main>
    </div>
  );
}
