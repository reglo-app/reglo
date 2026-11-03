import { postPublic, type ApiCallResult } from "@/lib/api/call";

/** What the link of an invitation e-mail is for (US-03). */
export type InvitationDetails = {
    email: string;
    firstName: string | null;
    lastName: string | null;
    organizationName: string | null;
    inviterName: string | null;
};

export type InvitationCheck =
    | { status: "valid"; invitation: InvitationDetails }
    | { status: "invalid" }
    | { status: "unavailable" };

/**
 * `POST /api/invitations/check`. Public: the invited person has no account
 * yet.
 */
export async function checkInvitationToken(
    token: string,
): Promise<InvitationCheck> {
    const result = await postPublic<Partial<InvitationDetails>>(
        "/api/invitations/check",
        { token },
    );
    if (result.status !== "success") {
        return result.status === "rejected"
            ? { status: "invalid" }
            : { status: "unavailable" };
    }

    const data = result.data;
    if (typeof data?.email !== "string") {
        return { status: "unavailable" };
    }

    return {
        status: "valid",
        invitation: {
            email: data.email,
            firstName: data.firstName ?? null,
            lastName: data.lastName ?? null,
            organizationName: data.organizationName ?? null,
            inviterName: data.inviterName ?? null,
        },
    };
}

/** `POST /api/invitations/accept`: creates the account. */
export function submitInvitation(body: {
    token: string;
    firstName: string;
    lastName: string;
    password: string;
}): Promise<ApiCallResult<unknown>> {
    return postPublic("/api/invitations/accept", body);
}
