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
 * The personal data of the signed-in user as a JSON file (US-04, GDPR),
 * fetched from the API with the session token.
 */
export async function GET() {
    const token = await getSessionToken();
    if (!token) redirect("/login?next=/settings");

    let response: Response;
    try {
        response = await fetch(`${API_INTERNAL_URL}/api/me/export`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        });
    } catch {
        return failure(
            "L'export est indisponible pour le moment. Réessayez dans un instant.",
            503,
        );
    }

    if (response.status === 401) redirect("/session-expired");
    if (!response.ok || !response.body) {
        return failure(
            "L'export est indisponible pour le moment. Réessayez dans un instant.",
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
    ]) {
        const value = response.headers.get(name);
        if (value) headers.set(name, value);
    }

    return new Response(response.body, { headers });
}
