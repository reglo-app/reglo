import { API_INTERNAL_URL } from "@/lib/api/internal-url";
import { getSessionToken } from "@/lib/auth/session";

/**
 * Profile photo, fetched from the API with the session token: the browser
 * never holds the token (HttpOnly cookie), so it cannot call the API itself.
 * The API only shows photos of the same organization (404 otherwise).
 */
export async function GET(
    _request: Request,
    { params }: RouteContext<"/avatars/[userId]">,
) {
    const { userId } = await params;
    const token = await getSessionToken();

    if (!token || !/^\d+$/.test(userId)) {
        return new Response(null, { status: 404 });
    }

    let response: Response;
    try {
        response = await fetch(
            `${API_INTERNAL_URL}/api/users/${userId}/avatar`,
            {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
            },
        );
    } catch {
        return new Response(null, { status: 503 });
    }

    if (!response.ok || !response.body) {
        return new Response(null, { status: 404 });
    }

    return new Response(response.body, {
        headers: {
            "Content-Type": "image/webp",
            // The URL carries the photo version: a new photo is a new URL
            "Cache-Control": "private, max-age=86400",
            "X-Content-Type-Options": "nosniff",
        },
    });
}
