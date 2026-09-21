"use client";
import { ArrowRight, CircleAlert } from "lucide-react";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="not-found">
      <CircleAlert size={38} />
      <h1>A small interruption.</h1>
      <p>Something went wrong loading this page. Your saved clips are safe.</p>
      <button className="button button-dark" onClick={reset}>
        Try again <ArrowRight size={17} />
      </button>
    </main>
  );
}
