import type { Metadata } from "next";
import { Header } from "@/components/header";
import { AnalyticsView } from "@/components/analytics-view";
export const metadata: Metadata = {
  title: "Viewing insights",
  robots: { index: false, follow: false },
};
export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  return (
    <>
      <Header />
      <AnalyticsView videoId={videoId} />
    </>
  );
}
