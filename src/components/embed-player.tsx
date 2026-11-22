"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/types";

export function EmbedPlayer({ token }: { token: string }) {
  const [clip, setClip] = useState<{
      title: string;
      playbackUrl: string;
    } | null>(null),
    [error, setError] = useState(""),
    [password, setPassword] = useState("");
  const load = useCallback(async () => {
    try {
      setClip(await api(`/api/shares/${encodeURIComponent(token)}`));
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [token]);
  useEffect(() => {
    const task = setTimeout(() => void load(), 0);
    return () => clearTimeout(task);
  }, [load]);
  return (
    <main id="main" className="embed-player">
      {clip ? (
        <video
          src={clip.playbackUrl}
          controls
          playsInline
          aria-label={clip.title}
          onError={() =>
            setError("Playback expired. Open the clip to continue.")
          }
        />
      ) : (
        <p>{error || "Opening clip…"}</p>
      )}
      {error.includes("requires a password") && (
        <form
          className="share-unlock"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              sessionStorage.setItem(`clip-share:${token}`, password);
              void load();
            } catch {
              setError("Open the clip in a new tab to enter its password.");
            }
          }}
        >
          <label htmlFor="embed-password">Link password</label>
          <input
            id="embed-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            maxLength={72}
          />
          <button className="button button-dark">Unlock clip</button>
        </form>
      )}
      <a
        href={`/s/${encodeURIComponent(token)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {clip?.title || "Open clip"} · Made with Clip ↗
      </a>
    </main>
  );
}
