"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, LogOut, Video } from "lucide-react";
import { useState } from "react";
import { useSession } from "./session-provider";
import { Logo } from "./ui";
import { errorMessage } from "@/lib/types";

export function Header({ marketing = false }: { marketing?: boolean }) {
  const { user, signOut } = useSession();
  const path = usePathname();
  const [error, setError] = useState("");
  return (
    <header className={marketing ? "marketing-header" : "app-header"}>
      <nav
        aria-label="Main navigation"
        className={marketing ? "floating-nav" : "app-nav"}
      >
        <Logo />
        <div className="nav-links">
          {marketing && (
            <a className="nav-secondary" href="#how-it-works">
              How it works
            </a>
          )}
          <Link
            href="/dashboard"
            className={path === "/dashboard" ? "active" : ""}
          >
            {marketing ? "Library" : "My library"}
          </Link>
          {!marketing && (
            <Link href="/record" className={path === "/record" ? "active" : ""}>
              Recorder
            </Link>
          )}
        </div>
        <div className="nav-actions">
          {user ? (
            <>
              <span className="avatar" title={user.displayName}>
                {user.displayName.slice(0, 1).toUpperCase()}
              </span>
              <button
                className="icon-button"
                title="Log out"
                aria-label="Log out"
                onClick={() => {
                  signOut().catch((e) => setError(errorMessage(e)));
                }}
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <Link href="/login" className="login-link">
              Log in
            </Link>
          )}
          <Link
            href={marketing ? "/register" : "/record"}
            className="button button-dark button-small"
          >
            {marketing ? (
              <>
                Get started <ArrowUpRight size={16} />
              </>
            ) : (
              <>
                <Video size={17} /> Record a video
              </>
            )}
          </Link>
        </div>
      </nav>
      {error && (
        <p role="alert" className="header-error">
          {error}
        </p>
      )}
    </header>
  );
}
