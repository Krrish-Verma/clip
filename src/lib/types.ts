export type User = { id: string; email: string; displayName: string };
export type VideoStatus = "UPLOADING" | "PROCESSING" | "READY" | "FAILED";
export type ClipVideo = {
  id: string;
  title: string;
  status: VideoStatus;
  visibility: "PRIVATE" | "UNLISTED";
  durationSeconds: number | null;
  thumbnailUrl?: string;
  createdAt: string;
  views: number;
  creatorDisplayName?: string;
  folderId?: string | null;
  favorite: boolean;
  archived: boolean;
};
export type Comment = {
  authorId?: string;
  parentId?: string;
  resolved: boolean;
  editedAt?: string;
  id: string;
  displayName: string;
  message: string;
  timestampSeconds: number;
  createdAt: string;
};
export type Analytics = {
  totalViews: number;
  uniqueViewers: number;
  averageWatchPercentage: number;
  completionRate: number;
  averageWatchTimeSeconds: number;
};
export type Folder = { id: string; name: string };
export type Reaction = { emoji: string; count: number; mine: boolean };
export type Participant = {
  id: string;
  displayName: string;
  clerkUserId: string;
};
export type Notification = {
  id: string;
  videoId: string;
  videoTitle: string;
  message: string;
  createdAt: string;
  read: boolean;
  canOpen: boolean;
};
export function duration(seconds: number | null = 0) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(safe / 60)
    .toString()
    .padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
}
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
