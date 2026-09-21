import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CircleHelp } from "lucide-react";
import { Header } from "@/components/header";
import { Recorder } from "@/components/recorder";
export const metadata: Metadata = { title: "Record a video" };
export default function RecordPage() {
  return (
    <>
      <Header />
      <main id="main" className="app-main recorder-page">
        <Link className="back-link" href="/dashboard">
          <ArrowLeft size={16} /> My library
        </Link>
        <div className="page-heading">
          <div>
            <span className="eyebrow">LET’S MAKE IT CLEAR</span>
            <h1>Ready when you are.</h1>
            <p>A walkthrough is worth a thousand messages.</p>
          </div>
          <span className="limit-pill">10 min per clip · 200 MB max</span>
        </div>
        <Recorder />
        <details className="record-help">
          <summary>
            <CircleHelp size={17} /> A few tips for a great clip
          </summary>
          <div>
            <p>
              <strong>Choose what to share.</strong> A browser tab keeps things
              focused. An entire screen lets you switch between apps.
            </p>
            <p>
              <strong>Make yourself heard.</strong> Turn on your microphone for
              narration. Screen audio depends on your browser and selected
              source.
            </p>
            <p>
              <strong>Take your time.</strong> You can pause, resume, and review
              before uploading. Recording stops automatically at 10 minutes.
            </p>
          </div>
        </details>
      </main>
    </>
  );
}
