import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getAuthServer, isAuthConfigured } from "@/lib/auth/server";

export default async function proxy(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.next();
  }

  const middleware = getAuthServer().middleware({
    loginUrl: "/auth/sign-in"
  });

  return middleware(request);
}

export const config = {
  matcher: ["/((?!api|auth|_next/static|_next/image|favicon.ico).*)"]
};
