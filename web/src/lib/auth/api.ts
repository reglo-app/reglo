/**
 * Server-side URL of the API. In Docker the web container reaches the API
 * by its service name, not by the public URL used in the browser.
 */
const API_INTERNAL_URL =
    process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";

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
