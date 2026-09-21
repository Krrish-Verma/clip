import type { Metadata } from "next";
import { Header } from "@/components/header";
import { VideoView } from "@/components/video-view";
export const metadata: Metadata = {
  title: "Watch a clip",
  robots: { index: false, follow: false },
};
export default async function SharePage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  return (
    <>
      <Header />
      <VideoView shareToken={shareToken} />
    </>
  );
}
