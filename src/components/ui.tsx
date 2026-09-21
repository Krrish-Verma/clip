import Link from "next/link";
import { ArrowUpRight, Video, CircleAlert, LoaderCircle } from "lucide-react";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Clip home"
      className={`logo ${light ? "logo-light" : ""}`}
    >
      <Video size={30} strokeWidth={2.8} fill="currentColor" />
      <span>clip</span>
    </Link>
  );
}
export function ErrorNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="notice notice-error" role="alert">
      <CircleAlert size={18} />
      <div>{children}</div>
    </div>
  );
}
export function Loading({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>{text}</span>
    </div>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <Logo />
      <p>A little video. A lot more clarity.</p>
      <Link href="/record">
        Make your first clip <ArrowUpRight size={17} />
      </Link>
    </footer>
  );
}
