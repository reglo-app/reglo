import { API_INTERNAL_URL } from "@/lib/api/internal-url";

export type LoginResult =
    | { status: "success"; token: string }
    | { status: "invalid" }
    | { status: "throttled" }
    | { status: "unavailable" };

/** `POST /api/auth/login`: exchanges e-mail and password for a token. */
export async function requestAccessToken(
    email: string,
    password: string,
): Promise<LoginResult> {
    let response: Response;
    try {
        response = await fetch(`${API_INTERNAL_URL}/api/auth/login`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
            cache: "no-store",
        });
    } catch {
        return { status: "unavailable" };
    }

    if (response.status === 401) {
        return { status: "invalid" };
    }
    if (response.status === 429) {
        return { status: "throttled" };
    }
    if (!response.ok) {
        return { status: "unavailable" };
    }

    const body = (await response.json().catch(() => null)) as {
        token?: unknown;
    } | null;

    return typeof body?.token === "string"
        ? { status: "success", token: body.token }
        : { status: "unavailable" };
}

/**
 * `POST /api/auth/logout`: the token stops working at once. Best effort:
 * even when the API cannot be reached, the browser forgets the token.
 */
export async function revokeAccessToken(token: string): Promise<void> {
    try {
        await fetch(`${API_INTERNAL_URL}/api/auth/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });
    } catch {
        // Nothing to do: the token expires on its own (1 h).
    }
}

/** True only when the API accepts the token (`GET /api/auth/me`). */
export async function isAccessTokenValid(token: string): Promise<boolean> {
    try {
        const response = await fetch(`${API_INTERNAL_URL}/api/auth/me`, {
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
        });
        return response.ok;
    } catch {
        return false;
    }
}
