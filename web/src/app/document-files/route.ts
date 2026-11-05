import { API_INTERNAL_URL } from "@/lib/api/internal-url";
import { getSessionToken } from "@/lib/auth/session";
import {
    DOCUMENT_MAX_BYTES,
    DOCUMENT_MESSAGES,
} from "@/lib/documents/documents";

/** The file plus the rest of the form (same margin as post_max_size). */
const MAX_REQUEST_BYTES = DOCUMENT_MAX_BYTES + 1024 * 1024;

function refusal(error: string, code: string, status: number) {
    return Response.json({ error, code }, { status });
}

/**
 * Upload of a document (US-11): the browser never holds the token (HttpOnly
 * cookie), so it cannot call the API itself. The file is passed on as it
 * arrives, without being kept in memory; the API checks it. Not reachable
 * from another site: the session cookie is SameSite=Lax.
 */
export async function POST(request: Request) {
    const token = await getSessionToken();
    if (!token) {
        return refusal(
            "Votre session a expiré. Reconnectez-vous.",
            "session_expired",
            401,
        );
    }

    const contentType = request.headers.get("content-type") ?? "";
    const contentLength = Number(request.headers.get("content-length"));
    if (
        !contentType.startsWith("multipart/form-data") ||
        !contentLength ||
        !request.body
    ) {
        return refusal(DOCUMENT_MESSAGES.unavailable, "invalid_request", 400);
    }
    if (contentLength > MAX_REQUEST_BYTES) {
        return refusal(DOCUMENT_MESSAGES.tooLarge, "too_large", 422);
    }

    let response: Response;
    try {
        response = await fetch(`${API_INTERNAL_URL}/api/documents`, {
            method: "POST",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
                "Content-Type": contentType,
                "Content-Length": String(contentLength),
            },
            body: request.body,
            // Required by Node.js to send a stream
            duplex: "half",
            cache: "no-store",
        } as RequestInit & { duplex: "half" });
    } catch {
        return refusal(DOCUMENT_MESSAGES.unavailable, "unavailable", 503);
    }

    if (response.status === 401) {
        return refusal(
            "Votre session a expiré. Reconnectez-vous.",
            "session_expired",
            401,
        );
    }
    if (response.status === 403) {
        return refusal(
            "Votre rôle ne permet pas de déposer un justificatif.",
            "forbidden",
            403,
        );
    }

    // Only the API's own messages, written for users (rule 3).
    const body = (await response.json().catch(() => null)) as {
        error?: unknown;
        code?: unknown;
    } | null;
    if (response.status === 201 && body) {
        return Response.json(body, { status: 201 });
    }
    if (
        response.status === 422 &&
        typeof body?.error === "string" &&
        typeof body.code === "string"
    ) {
        return refusal(body.error, body.code, 422);
    }
    return refusal(DOCUMENT_MESSAGES.unavailable, "unavailable", 503);
}
