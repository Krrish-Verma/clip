"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { ClerkSessionProvider, UnconfiguredSessionProvider } from "./session-provider";

export function Providers({ children, clerkPublishableKey }: { children: React.ReactNode; clerkPublishableKey?: string }) {
  if (!clerkPublishableKey) return <UnconfiguredSessionProvider>{children}</UnconfiguredSessionProvider>;
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} signInUrl="/login" signUpUrl="/register" afterSignOutUrl="/">
      <ClerkSessionProvider>{children}</ClerkSessionProvider>
    </ClerkProvider>
  );
}
