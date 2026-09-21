"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, refreshSession, setAccessToken } from "@/lib/api";
import type { User } from "@/lib/types";

type Session = {
  user: User | null;
  loading: boolean;
  signIn: (user: User, token: string) => void;
  signOut: () => Promise<void>;
};
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    refreshSession()
      .then((value) => {
        if (active) setUser(value);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const restore = () => {
      void refreshSession()
        .then(setUser)
        .catch(() => {});
    };
    window.addEventListener("focus", restore);
    return () => window.removeEventListener("focus", restore);
  }, []);
  const signIn = useCallback((value: User, token: string) => {
    setAccessToken(token);
    setUser(value);
  }, []);
  const signOut = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" });
    setAccessToken(null);
    setUser(null);
  }, []);
  return (
    <Context.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const context = useContext(Context);
  if (!context) throw new Error("Session provider missing");
  return context;
}
