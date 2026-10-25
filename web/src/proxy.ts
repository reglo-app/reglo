import { NextResponse, type NextRequest } from "next/server";

// Same value as SESSION_COOKIE in lib/auth/session.ts (that module uses
// next/headers, which the proxy cannot import).
const SESSION_COOKIE = "reglo_session";

/** Pages reachable without being signed in. */
const PUBLIC_PATHS = ["/login"];

/**
 * Optimistic check on the cookie only: the API still checks the token on
 * every request and answers 401 if it is invalid or expired.
 */
export function proxy(request: NextRequest) {
    const { pathname, search } = request.nextUrl;
    const isSignedIn = request.cookies.has(SESSION_COOKIE);
    const isPublic = PUBLIC_PATHS.includes(pathname);

    if (!isSignedIn && !isPublic) {
        const loginUrl = new URL("/login", request.url);
        if (pathname !== "/") {
            loginUrl.searchParams.set("next", `${pathname}${search}`);
        }
        return NextResponse.redirect(loginUrl);
    }

    if (isSignedIn && isPublic) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
}

export const config = {
    // Skip the API (served by Symfony behind Caddy), Next.js assets and
    // files from public/ (anything with an extension).
    matcher: ["/((?!api|bundles|_next/static|_next/image|.*\\.[\\w]+$).*)"],
};
