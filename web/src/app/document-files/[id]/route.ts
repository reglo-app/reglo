import { redirect } from "next/navigation";

import { API_INTERNAL_URL } from "@/lib/api/internal-url";
import { getSessionToken } from "@/lib/auth/session";

/** Opened by a link: a short sentence in place of the file, never details. */
function failure(message: string, status: number) {
    return new Response(message, {
        status,
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Content-Type-Options": "nosniff",
        },
    });
}

/**
 * A document (US-11), fetched from the API with the session token: as an
 * attachment, or shown in the browser with "?view=1" (PDF and images only).
 * The API only serves the documents of the same organization (404 otherwise)
 * and sets the headers that keep a file from running as a page.
 */
export async function GET(
    request: Request,
    { params }: RouteContext<"/document-files/[id]">,
) {
    const { id } = await params;
    const view = new URL(request.url).searchParams.has("view");
    const token = await getSessionToken();
    if (!token) redirect("/login?next=/documents");

    if (!/^\d+$/.test(id)) {
        return failure("Ce justificatif n'existe pas.", 404);
    }

    let response: Response;
    try {
        response = await fetch(
            `${API_INTERNAL_URL}/api/documents/${id}/${view ? "view" : "download"}`,
            {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            },
        );
    } catch {
        return failure(
            "Le téléchargement est impossible pour le moment. Réessayez dans un instant.",
            503,
        );
    }

    if (response.status === 401) redirect("/session-expired");
    if (response.status === 404 || !response.body) {
        return failure("Ce justificatif n'existe pas ou a été supprimé.", 404);
    }
    if (!response.ok) {
        return failure(
            "Le téléchargement est impossible pour le moment. Réessayez dans un instant.",
            503,
        );
    }

    const headers = new Headers({
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
    });
    for (const name of [
        "Content-Type",
        "Content-Length",
        "Content-Disposition",
        "Content-Security-Policy",
    ]) {
        const value = response.headers.get(name);
        if (value) headers.set(name, value);
    }

    return new Response(response.body, { headers });
}
