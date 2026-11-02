import { redirect } from "next/navigation";

import { API_INTERNAL_URL } from "@/lib/api/internal-url";
import { getSessionToken } from "@/lib/auth/session";

/**
 * Answer of a "Mon profil" call. On "rejected", `message` comes from the
 * API: written for users, in French, never a technical detail (rule 3).
 */
export type ProfileCallResult<T = null> =
    | { status: "success"; data: T }
    | {
          status: "rejected";
          code: string;
          message: string;
          /** Message per field, when the API names them. */
          fields?: Record<string, string>;
      }
    | { status: "unavailable" };

type ErrorBody = {
    error?: unknown;
    code?: unknown;
    fields?: unknown;
};

/**
 * Calls the API as the signed-in user. A refused session opens the login
 * page, like every private page (see lib/api/client.ts).
 */
export async function callProfileApi<T = null>(
    method: "PATCH" | "POST" | "DELETE",
    path: string,
    body?: Record<string, unknown> | FormData,
): Promise<ProfileCallResult<T>> {
    const token = await getSessionToken();
    if (!token) redirect("/session-expired");

    const headers: Record<string, string> = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
    };
    // FormData sets its own multipart content type
    if (body && !(body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    let response: Response;
    try {
        response = await fetch(`${API_INTERNAL_URL}${path}`, {
            method,
            headers,
            body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
            cache: "no-store",
        });
    } catch {
        return { status: "unavailable" };
    }

    if (response.status === 401) redirect("/session-expired");

    if (response.ok) {
        const data =
            response.status === 200
                ? ((await response.json().catch(() => null)) as T)
                : (null as T);
        return { status: "success", data };
    }

    return toRejection(response);
}

/** 4xx with a message for users; anything else is "unavailable". */
async function toRejection(
    response: Response,
): Promise<ProfileCallResult<never>> {
    if (response.status < 400 || response.status >= 500) {
        return { status: "unavailable" };
    }

    const body = (await response.json().catch(() => null)) as ErrorBody | null;
    if (typeof body?.error !== "string" || typeof body.code !== "string") {
        return { status: "unavailable" };
    }

    const fields =
        body.fields && typeof body.fields === "object"
            ? Object.fromEntries(
                  Object.entries(body.fields).filter(
                      (entry): entry is [string, string] =>
                          typeof entry[1] === "string",
                  ),
              )
            : undefined;

    return { status: "rejected", code: body.code, message: body.error, fields };
}

export type EmailChangeCheck =
    | { status: "valid"; newEmail: string }
    | { status: "invalid" }
    | { status: "unavailable" };

/**
 * `POST /api/email-change/check`: the address a confirmation link is for.
 * Public: the link may be opened on any browser.
 */
export async function checkEmailChangeToken(
    token: string,
): Promise<EmailChangeCheck> {
    const result = await postPublic("/api/email-change/check", { token });
    if (result.status !== "success") {
        return result.status === "rejected"
            ? { status: "invalid" }
            : { status: "unavailable" };
    }

    const newEmail = (result.data as { newEmail?: unknown } | null)?.newEmail;
    return typeof newEmail === "string"
        ? { status: "valid", newEmail }
        : { status: "unavailable" };
}

/** `POST /api/email-change/confirm`: applies the new address. */
export function confirmEmailChange(
    token: string,
): Promise<ProfileCallResult<unknown>> {
    return postPublic("/api/email-change/confirm", { token });
}

async function postPublic(
    path: string,
    body: Record<string, unknown>,
): Promise<ProfileCallResult<unknown>> {
    let response: Response;
    try {
        response = await fetch(`${API_INTERNAL_URL}${path}`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            cache: "no-store",
        });
    } catch {
        return { status: "unavailable" };
    }

    if (response.ok) {
        const data =
            response.status === 200
                ? await response.json().catch(() => null)
                : null;
        return { status: "success", data };
    }

    return toRejection(response);
}
