import { redirect } from "next/navigation";

import { isAccessTokenValid } from "@/lib/auth/api";
import { clearSession, getSessionToken } from "@/lib/auth/session";

/**
 * Reached when the API refused the session token (expired or revoked): the
 * cookie is deleted, then the login page opens. The token is checked again
 * first, so a link to this page cannot sign a user out.
 */
export async function GET(): Promise<never> {
    const token = await getSessionToken();
    if (token && (await isAccessTokenValid(token))) {
        redirect("/dashboard");
    }

    await clearSession();
    redirect("/login");
}
