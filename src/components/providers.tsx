"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { createContext, useContext } from "react";
import { ClerkSessionProvider, UnconfiguredSessionProvider } from "./session-provider";

const ConfigurationContext = createContext(false);

export function Providers({ children, clerkPublishableKey, clerkConfigured }: { children: React.ReactNode; clerkPublishableKey?: string; clerkConfigured: boolean }) {
  if (!clerkPublishableKey || !clerkConfigured)
    return <ConfigurationContext.Provider value={false}><UnconfiguredSessionProvider>{children}</UnconfiguredSessionProvider></ConfigurationContext.Provider>;
  return (
    <ConfigurationContext.Provider value>
      <ClerkProvider publishableKey={clerkPublishableKey} signInUrl="/login" signUpUrl="/register" afterSignOutUrl="/">
        <ClerkSessionProvider>{children}</ClerkSessionProvider>
      </ClerkProvider>
    </ConfigurationContext.Provider>
  );
}

export function useClerkConfigured() { return useContext(ConfigurationContext); }
