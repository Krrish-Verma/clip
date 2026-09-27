"use client";

import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setTokenProvider } from "@/lib/api";
import type { User } from "@/lib/types";

type Session = { user: User | null; loading: boolean; signOut: () => Promise<void> };
const Context = createContext<Session | null>(null);

export function ClerkSessionProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const clerk = useClerk();
  const [tokenReady, setTokenReady] = useState(false);
  const user = useMemo(() => isSignedIn && clerkUser
    ? ({
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || "",
        displayName: clerkUser.fullName || clerkUser.firstName || clerkUser.username || "Clip user",
      } satisfies User)
    : null, [isSignedIn, clerkUser]);

  useEffect(() => {
    let active = true;
    setTokenProvider((force) => getToken({ skipCache: force }));
    queueMicrotask(() => { if (active) setTokenReady(true); });
    return () => { active = false; setTokenProvider(null); };
  }, [getToken]);

  useEffect(() => {
    if (!user) return;
    void api("/api/users/me", {
      method: "PUT",
      body: JSON.stringify({ email: user.email || null, displayName: user.displayName }),
    }).catch(() => {
      /* Profile sync is retried next session; API authorization remains authoritative. */
    });
  }, [user]);

  const signOut = useCallback(async () => {
    await clerk.signOut({ redirectUrl: "/" });
  }, [clerk]);

  return <Context.Provider value={{ user, loading: !isLoaded || !tokenReady, signOut }}>{children}</Context.Provider>;
}

export function UnconfiguredSessionProvider({ children }: { children: React.ReactNode }) {
  return <Context.Provider value={{ user: null, loading: false, signOut: async () => {} }}>{children}</Context.Provider>;
}

export function useSession() {
  const context = useContext(Context);
  if (!context) throw new Error("Session provider missing");
  return context;
}
