import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { SessionProvider } from "@/components/session-provider";

export const metadata: Metadata = {
  title: {
    default: "Clip — Explain it once. Share it instantly.",
    template: "%s — Clip",
  },
  description:
    "A little video. A lot more clarity. Record your screen, share your thinking, and keep the conversation moving with Clip.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
