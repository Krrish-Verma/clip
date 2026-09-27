export const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";
export const authConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
export const cloudConfigured = Boolean(API_URL && authConfigured);
let tokenProvider: ((forceRefresh: boolean) => Promise<string | null>) | null = null;

export function setTokenProvider(provider: typeof tokenProvider) { tokenProvider = provider; }

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "ApiError"; }
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  if (!API_URL) throw new ApiError("Cloud services aren’t connected yet. You can still record, preview, and download a video.", 503);
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const token = tokenProvider ? await tokenProvider(!retry) : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Couldn’t reach Clip. Check your connection and try again.", 0);
  }
  if (response.status === 401 && retry && tokenProvider) return api<T>(path, init, false);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(
      data.message || (response.status === 404 ? "This video is no longer available." : response.status === 401 ? "Please log in to continue." : "Something went wrong. Please try again."),
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function uploadMedia(url: string, blob: Blob, onProgress: (progress: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", blob.type.split(";")[0]);
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed. Your recording is still here; please try again."));
    xhr.onerror = () => reject(new Error("Upload interrupted. Check your connection and try again."));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Please try again."));
    xhr.timeout = 15 * 60 * 1000;
    xhr.send(blob);
  });
}
