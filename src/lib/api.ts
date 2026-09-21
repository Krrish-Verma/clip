import type { User } from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";
export const cloudConfigured = Boolean(API_URL);
let accessToken: string | null = null;
let refreshRequest: Promise<User | null> | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function refreshSession(): Promise<User | null> {
  if (!cloudConfigured) return null;
  if (refreshRequest) return refreshRequest;
  refreshRequest = (async () => {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (response.status === 401 || response.status === 403) {
      accessToken = null;
      return null;
    }
    if (!response.ok)
      throw new ApiError(
        "Your session could not be restored. Please try again.",
        response.status,
      );
    const data = await response.json();
    accessToken = data.accessToken;
    return data.user || (await api<User>("/api/auth/me", {}, false));
  })().finally(() => {
    refreshRequest = null;
  });
  return refreshRequest;
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  if (!cloudConfigured)
    throw new ApiError(
      "Cloud services aren’t connected yet. You can still record, preview, and download a video.",
      503,
    );
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      "Couldn’t reach Clip. Check your connection and try again.",
      0,
    );
  }
  if (response.status === 401 && retry && !path.startsWith("/api/auth/")) {
    if (await refreshSession()) return api<T>(path, init, false);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      data.message ||
        (response.status === 404
          ? "This video is no longer available."
          : response.status === 401
            ? "Please log in to continue."
            : "Something went wrong. Please try again."),
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function uploadMedia(
  url: string,
  blob: Blob,
  onProgress: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", blob.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(
            new Error(
              "Upload failed. Your recording is still here; please try again.",
            ),
          );
    xhr.onerror = () =>
      reject(
        new Error("Upload interrupted. Check your connection and try again."),
      );
    xhr.ontimeout = () =>
      reject(new Error("Upload timed out. Please try again."));
    xhr.timeout = 15 * 60 * 1000;
    xhr.send(blob);
  });
}
