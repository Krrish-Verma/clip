"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Video, LibraryBig } from "lucide-react";
import { Dialog } from "./dialog";

export function CommandMenu() {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <>
      <button
        className="command-trigger"
        onClick={() => setOpen(true)}
        aria-label="Quick navigation (Control or Command K)"
      >
        <Search size={15} />
        <span>Quick navigation</span>
        <kbd>⌘ K</kbd>
      </button>
      {open && (
        <Dialog title="Go somewhere" onClose={() => setOpen(false)}>
          <input
            aria-label="Filter navigation"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Where would you like to go?"
            autoFocus
          />
          <div className="command-links">
            {[
              { label: "My library", href: "/dashboard", icon: LibraryBig },
              { label: "Record a video", href: "/record", icon: Video },
            ]
              .filter((item) =>
                item.label.toLowerCase().includes(query.toLowerCase()),
              )
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <item.icon size={18} />
                  {item.label}
                  <span>↵</span>
                </Link>
              ))}
          </div>
        </Dialog>
      )}
    </>
  );
}
