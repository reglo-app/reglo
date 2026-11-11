import { API_INTERNAL_URL } from "@/lib/api/internal-url";

export type LoginResult =
    /** platformAdmin: REGLO team, who land on the back office. */
    | { status: "success"; token: string; platformAdmin: boolean }
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
        platformAdmin?: unknown;
    } | null;

    return typeof body?.token === "string"
        ? {
              status: "success",
              token: body.token,
              platformAdmin: body.platformAdmin === true,
          }
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

export type ActivationInvite = {
    email: string;
    firstName: string | null;
    organizationName: string | null;
};

export type ActivationCheckResult =
    | { status: "valid"; invite: ActivationInvite }
    | { status: "invalid" }
    | { status: "unavailable" };

export type ActivationResult =
    | { status: "success" }
    | { status: "invalid" }
    | { status: "weak_password" }
    | { status: "unavailable" };

function postJson(path: string, body: unknown): Promise<Response> {
    return fetch(`${API_INTERNAL_URL}${path}`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
    });
}

/**
 * `POST /api/activation/check`: who the activation link is for, or
 * "invalid" when it expired or was already used (US-01).
 */
export async function checkActivationToken(
    token: string,
): Promise<ActivationCheckResult> {
    let response: Response;
    try {
        response = await postJson("/api/activation/check", { token });
    } catch {
        return { status: "unavailable" };
    }

    if (response.status === 410) {
        return { status: "invalid" };
    }
    if (!response.ok) {
        return { status: "unavailable" };
    }

    const body = (await response
        .json()
        .catch(() => null)) as Partial<ActivationInvite> | null;

    if (typeof body?.email !== "string") {
        return { status: "unavailable" };
    }

    return {
        status: "valid",
        invite: {
            email: body.email,
            firstName: body.firstName ?? null,
            organizationName: body.organizationName ?? null,
        },
    };
}

/** `POST /api/activation`: sets the password chosen by the new user. */
export async function submitActivation(
    token: string,
    password: string,
): Promise<ActivationResult> {
    let response: Response;
    try {
        response = await postJson("/api/activation", { token, password });
    } catch {
        return { status: "unavailable" };
    }

    if (response.status === 204) {
        return { status: "success" };
    }
    if (response.status === 410) {
        return { status: "invalid" };
    }
    if (response.status === 422) {
        return { status: "weak_password" };
    }
    return { status: "unavailable" };
}

/**
 * `POST /api/activation/resend`: the API always answers 202, whether the
 * account exists or not, so false only means it could not be reached.
 */
export async function requestActivationLink(email: string): Promise<boolean> {
    try {
        const response = await postJson("/api/activation/resend", { email });
        return response.ok;
    } catch {
        return false;
    }
}
