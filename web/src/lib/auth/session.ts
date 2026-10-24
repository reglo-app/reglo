import { cookies } from "next/headers";

/** Also read by src/proxy.ts (keep the name in sync). */
export const SESSION_COOKIE = "reglo_session";

/** Same lifetime as the API access token (app.access_token_ttl). */
const SESSION_MAX_AGE = 60 * 60;

/**
 * The API access token is kept in an HttpOnly cookie: JavaScript in the
 * browser can never read it (US-02, CYB-02).
 */
export async function setSessionToken(token: string): Promise<void> {
    (await cookies()).set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE,
    });
}

export async function getSessionToken(): Promise<string | null> {
    return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function clearSession(): Promise<void> {
    (await cookies()).delete(SESSION_COOKIE);
}
