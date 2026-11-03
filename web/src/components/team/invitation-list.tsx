"use client";

import { useTransition } from "react";
import { LoaderCircle, RotateCw, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Invitation } from "@/lib/api";
import { formatDate } from "@/lib/format";
import {
    cancelInvitation,
    resendInvitation,
    type InvitationActionState,
} from "@/lib/team/actions";

export type InvitationListProps = {
    invitations: Invitation[];
    /** Injected in tests; the server actions by default. */
    resend?: typeof resendInvitation;
    cancel?: typeof cancelInvitation;
};

/** Pending invitations, for administrators: send again or cancel. */
export function InvitationList({
    invitations,
    resend = resendInvitation,
    cancel = cancelInvitation,
}: InvitationListProps) {
    if (invitations.length === 0) {
        return (
            <p className="px-5 py-4 text-ink-muted">
                Aucune invitation en attente.
            </p>
        );
    }

    return (
        <ul className="divide-y divide-border">
            {invitations.map((invitation) => (
                <InvitationRow
                    key={invitation.id}
                    invitation={invitation}
                    resend={resend}
                    cancel={cancel}
                />
            ))}
        </ul>
    );
}

function InvitationRow({
    invitation,
    resend,
    cancel,
}: {
    invitation: Invitation;
    resend: typeof resendInvitation;
    cancel: typeof cancelInvitation;
}) {
    const [isResending, startResend] = useTransition();
    const [isCancelling, startCancel] = useTransition();
    const isBusy = isResending || isCancelling;
    const name = [invitation.firstName, invitation.lastName]
        .filter(Boolean)
        .join(" ");

    function report(result: InvitationActionState) {
        if (result.done) toast.success(result.done);
        if (result.error) toast.error(result.error);
    }

    return (
        // Three columns from sm: the validity stays in the middle.
        <li className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-4">
            <div className="flex min-w-0 flex-col">
                <span className="font-medium wrap-break-word">
                    {invitation.email}
                </span>
                <span className="text-sm text-ink-muted">
                    {name && <>{name} · </>}
                    {invitation.invitedBy
                        ? `Invitée par ${invitation.invitedBy}, le ${formatDate(invitation.sentAt)}`
                        : `Envoyée le ${formatDate(invitation.sentAt)}`}
                </span>
            </div>
            {invitation.expired ? (
                <Badge variant="destructive" className="sm:justify-self-center">
                    Expirée
                </Badge>
            ) : (
                <Badge variant="info" className="sm:justify-self-center">
                    Valable jusqu&apos;au {formatDate(invitation.expiresAt)}
                </Badge>
            )}
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Button
                    variant="outline"
                    size="row"
                    disabled={isBusy}
                    aria-label={`Renvoyer l'invitation à ${invitation.email}`}
                    onClick={() =>
                        startResend(async () =>
                            report(
                                await resend(invitation.id, invitation.email),
                            ),
                        )
                    }
                >
                    {isResending ? (
                        <LoaderCircle
                            aria-hidden="true"
                            className="animate-spin"
                        />
                    ) : (
                        <RotateCw aria-hidden="true" />
                    )}
                    Renvoyer
                </Button>
                <Button
                    variant="destructive-outline"
                    size="row"
                    disabled={isBusy}
                    aria-label={`Annuler l'invitation de ${invitation.email}`}
                    onClick={() =>
                        startCancel(async () =>
                            report(
                                await cancel(invitation.id, invitation.email),
                            ),
                        )
                    }
                >
                    {isCancelling ? (
                        <LoaderCircle
                            aria-hidden="true"
                            className="animate-spin"
                        />
                    ) : (
                        <X aria-hidden="true" />
                    )}
                    Annuler
                </Button>
            </div>
        </li>
    );
}
