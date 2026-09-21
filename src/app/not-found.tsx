import Link from "next/link";
import { ArrowLeft, VideoOff } from "lucide-react";
import { Header } from "@/components/header";
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="not-found">
        <VideoOff size={40} strokeWidth={1.3} />
        <span className="eyebrow">404 / NOTHING TO SEE HERE</span>
        <h1>This clip went off-script.</h1>
        <p>The page may have moved, or the link may be incomplete.</p>
        <Link href="/dashboard" className="button button-dark">
          <ArrowLeft size={16} /> Back to your library
        </Link>
      </main>
    </>
  );
}
