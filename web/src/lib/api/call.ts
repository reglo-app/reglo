import { redirect } from "next/navigation";

import { getSessionToken } from "@/lib/auth/session";

import { API_INTERNAL_URL } from "./internal-url";

/**
 * Answer of an API call that changes data (server actions). On "rejected",
 * `message` comes from the API: written for users, in French, never a
 * technical detail (rule 3).
 */
export type ApiCallResult<T = null> =
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
 * page, like every private page (see client.ts).
 */
export async function callApi<T = null>(
    method: "PATCH" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: Record<string, unknown> | FormData,
): Promise<ApiCallResult<T>> {
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

    return response.ok ? success<T>(response) : toRejection(response);
}

/**
 * Calls a public API route (links of e-mails, opened on any browser,
 * signed in or not).
 */
export async function postPublic<T = unknown>(
    path: string,
    body: Record<string, unknown>,
): Promise<ApiCallResult<T>> {
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

    return response.ok ? success<T>(response) : toRejection(response);
}

/** The JSON body of a 200 or 201; null for an empty answer (204, 202). */
async function success<T>(response: Response): Promise<ApiCallResult<T>> {
    const data =
        response.status === 200 || response.status === 201
            ? ((await response.json().catch(() => null)) as T)
            : (null as T);
    return { status: "success", data };
}

/** 4xx with a message for users; anything else is "unavailable". */
async function toRejection(response: Response): Promise<ApiCallResult<never>> {
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
