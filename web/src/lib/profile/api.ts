import { callApi, postPublic, type ApiCallResult } from "@/lib/api/call";

/** Answer of a "Mon profil" call (see ApiCallResult). */
export type ProfileCallResult<T = null> = ApiCallResult<T>;

/** Calls the API as the signed-in user (see callApi). */
export const callProfileApi = callApi;

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
