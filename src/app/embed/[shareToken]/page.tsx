import type { Metadata } from "next";
import { EmbedPlayer } from "@/components/embed-player";
export const metadata: Metadata = {
  title: "Embedded clip",
  robots: { index: false, follow: false },
};
export default async function EmbedPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  return <EmbedPlayer token={shareToken} />;
}
