"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ShieldCheck, Video } from "lucide-react";
import { Logo } from "./ui";
import { useClerkConfigured } from "./providers";

export function AuthForm({ register = false }: { register?: boolean }) {
  const authConfigured = useClerkConfigured();
  return (
    <div className="auth-page">
      <header className="auth-header">
        <Logo />
        <Link href={register ? "/login" : "/register"}>
          {register ? "Already a member?" : "New to Clip?"}
          <strong>{register ? "Log in" : "Get started"} <ArrowUpRight size={15} /></strong>
        </Link>
      </header>
      <main id="main" className="auth-layout">
        <aside className="auth-story">
          <div className="auth-story-top">
            <span className="eyebrow">A LITTLE VIDEO. A LOT MORE CLARITY.</span>
            <h2>Good things<br />come in<br /><span>short clips.</span></h2>
            <p>For the ideas that deserve more<br />than another long message.</p>
          </div>
          <div className="auth-story-bottom"><Video size={33} /><span>Show it. Share it. Keep moving.</span></div>
        </aside>
        <div className="auth-form-wrap">
          <div className="auth-form-heading">
            <div className="auth-small-icon"><Video size={25} /></div>
            <h1>{register ? "Make yourself clear." : "Good to see you."}</h1>
            <p>{register ? "Create your account. Give your ideas a voice." : "Log in and pick up where you left off."}</p>
          </div>
          {authConfigured ? (
            register ? (
              <SignUp routing="path" path="/register" signInUrl="/login" forceRedirectUrl="/dashboard" appearance={appearance} />
            ) : (
              <SignIn routing="path" path="/login" signUpUrl="/register" forceRedirectUrl="/dashboard" appearance={appearance} />
            )
          ) : (
            <div className="notice auth-setup-state">
              <ShieldCheck size={18} />
              <div>
                <strong>Authentication needs configuration.</strong>
                <p>Add the Clerk variables from <code>.env.example</code>, then restart Clip. Public pages and local recording remain available.</p>
                <Link href="/record">Try the recorder <ArrowRight size={13} /></Link>
              </div>
            </div>
          )}
          <p className="auth-fineprint"><ShieldCheck size={15} /> Your ideas are in good company. And stay private.</p>
        </div>
      </main>
      <footer className="auth-footer"><span>© {new Date().getFullYear()} Clip</span><Link href="/">Back to home <ArrowUpRight size={14} /></Link></footer>
    </div>
  );
}

const appearance = {
  elements: {
    rootBox: { width: "100%", marginTop: "30px" },
    cardBox: { width: "100%", boxShadow: "none" },
    card: { width: "100%", boxShadow: "none", padding: 0, background: "transparent" },
    header: { display: "none" },
    footer: { background: "transparent" },
    formButtonPrimary: { background: "#111", borderRadius: "999px", textTransform: "none" as const, fontWeight: 650 },
    formFieldInput: { borderRadius: "10px", borderColor: "#d5d5d0", boxShadow: "none" },
    socialButtonsBlockButton: { borderRadius: "999px", borderColor: "#d5d5d0" },
    footerActionLink: { color: "#111", fontWeight: 650 },
  },
};
