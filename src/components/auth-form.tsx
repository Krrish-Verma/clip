"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
  Video,
} from "lucide-react";
import { api, cloudConfigured } from "@/lib/api";
import { errorMessage, type User } from "@/lib/types";
import { useSession } from "./session-provider";
import { Logo, ErrorNotice } from "./ui";

export function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const { signIn } = useSession();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    if (register && data.get("password") !== data.get("confirmPassword")) {
      setError("Your passwords don’t match. Please try again.");
      return;
    }
    setPending(true);
    try {
      const result = await api<{ user: User; accessToken: string }>(
        `/api/auth/${register ? "register" : "login"}`,
        {
          method: "POST",
          body: JSON.stringify({
            email: String(data.get("email")).trim(),
            password: data.get("password"),
            ...(register
              ? { displayName: String(data.get("name")).trim() }
              : {}),
          }),
        },
      );
      signIn(result.user, result.accessToken);
      router.push("/dashboard");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="auth-page">
      <header className="auth-header">
        <Logo />
        <Link href={register ? "/login" : "/register"}>
          {register ? "Already a member?" : "New to Clip?"}
          <strong>
            {register ? "Log in" : "Get started"} <ArrowUpRight size={15} />
          </strong>
        </Link>
      </header>
      <main id="main" className="auth-layout">
        <aside className="auth-story">
          <div className="auth-story-top">
            <span className="eyebrow">A LITTLE VIDEO. A LOT MORE CLARITY.</span>
            <h2>
              Good things
              <br />
              come in
              <br />
              <span>short clips.</span>
            </h2>
            <p>
              For the ideas that deserve more
              <br />
              than another long message.
            </p>
          </div>
          <div className="auth-story-bottom">
            <Video size={33} />
            <span>Show it. Share it. Keep moving.</span>
          </div>
        </aside>
        <div className="auth-form-wrap">
          <div className="auth-form-heading">
            <div className="auth-small-icon">
              <Video size={25} />
            </div>
            <h1>{register ? "Make yourself clear." : "Good to see you."}</h1>
            <p>
              {register
                ? "Create your account. Give your ideas a voice."
                : "Log in and pick up where you left off."}
            </p>
          </div>
          <form onSubmit={submit} className="auth-form">
            {!cloudConfigured && (
              <div className="notice">
                <ShieldCheck size={18} />
                <div>
                  Accounts will be available when cloud services are connected.{" "}
                  <Link href="/record">
                    Try recording without an account <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            )}
            {register && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={100}
                  placeholder="Alex Morgan"
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>
            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={register ? "new-password" : "current-password"}
                  required
                  minLength={register ? 12 : 1}
                  maxLength={72}
                  placeholder={
                    register ? "At least 12 characters" : "Enter your password"
                  }
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {register && (
              <label>
                Confirm password
                <input
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={72}
                  placeholder="One more time"
                />
              </label>
            )}
            {error && <ErrorNotice>{error}</ErrorNotice>}
            <button
              className="button button-dark"
              disabled={pending || !cloudConfigured}
            >
              {pending ? (
                <LoaderCircle size={18} className="spin" />
              ) : (
                <>
                  {register ? "Create your account" : "Log in"}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          <p className="auth-fineprint">
            <ShieldCheck size={15} /> Your ideas are in good company. And stay
            private.
          </p>
        </div>
      </main>
      <footer className="auth-footer">
        <span>© {new Date().getFullYear()} Clip</span>
        <Link href="/">
          Back to home <ArrowUpRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
