import type { Metadata } from "next";
import { Header } from "@/components/header";
import { VideoView } from "@/components/video-view";
export const metadata: Metadata = {
  title: "Watch your clip",
  robots: { index: false, follow: false },
};
export default async function VideoPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  return (
    <>
      <Header />
      <VideoView videoId={videoId} />
    </>
  );
}
