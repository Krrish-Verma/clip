import { createClerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const secretKey = process.env.CLERK_SECRET_KEY;
const clerk = publishableKey && secretKey
  ? createClerkClient({ publishableKey, secretKey })
  : null;
const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES ||
  "http://127.0.0.1:3000,http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function copyClerkHeaders(source: Headers, target: Headers) {
  source.forEach((value, key) => target.append(key, value));
}

export default async function proxy(request: NextRequest) {
  if (!clerk) return NextResponse.next();

  const requestState = await clerk.authenticateRequest(request, {
    authorizedParties,
  });

  if (requestState.status === "handshake") {
    return new NextResponse(null, { status: 307, headers: requestState.headers });
  }

  if (!requestState.isSignedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next();
  copyClerkHeaders(requestState.headers, response.headers);
  return response;
}

export const config = {
  matcher: ["/dashboard(.*)", "/record(.*)", "/videos(.*)"],
};
