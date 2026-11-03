import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert } from "lucide-react";

import { AuthHeading, AuthLayout } from "@/components/auth/auth-layout";
import { AcceptInvitationForm } from "@/components/team/accept-invitation-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/api/types";
import { checkInvitationToken } from "@/lib/team/api";

export const metadata: Metadata = {
    title: "Invitation",
    // The URL holds a secret token: never send it to other sites.
    referrer: "no-referrer",
};

type SearchParams = PageProps<"/invitation">["searchParams"];

/** Link of the invitation e-mail (US-03): the person joins the team. */
export default function InvitationPage({
    searchParams,
}: {
    searchParams: SearchParams;
}) {
    return (
        <AuthLayout>
            <Suspense fallback={<InvitationSkeleton />}>
                <InvitationContent searchParams={searchParams} />
            </Suspense>
        </AuthLayout>
    );
}

async function InvitationContent({
    searchParams,
}: {
    searchParams: SearchParams;
}) {
    const { token } = await searchParams;
    const result =
        typeof token === "string" && token
            ? await checkInvitationToken(token)
            : ({ status: "invalid" } as const);

    if (result.status === "unavailable") {
        return (
            <>
                <AuthHeading title="Invitation" />
                <Alert variant="destructive">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>
                        L&apos;invitation ne peut pas être ouverte pour le
                        moment. Réessayez plus tard.
                    </AlertDescription>
                </Alert>
            </>
        );
    }

    if (result.status === "invalid") {
        return (
            <>
                <AuthHeading title="Invitation expirée">
                    Cette invitation a expiré ou a déjà été utilisée. Demandez à
                    votre administrateur de vous en envoyer une nouvelle.
                </AuthHeading>
                <p className="text-center text-sm text-ink-muted">
                    Vous avez déjà un compte ?{" "}
                    <Link
                        href="/login"
                        className="link-underline font-medium text-green-700"
                    >
                        Se connecter
                    </Link>
                </p>
            </>
        );
    }

    const { invitation } = result;

    return (
        <>
            <AuthHeading
                title={
                    invitation.organizationName
                        ? `Rejoignez ${invitation.organizationName}`
                        : "Rejoignez votre équipe"
                }
            >
                {invitation.inviterName && (
                    <>
                        <span className="font-medium text-ink">
                            {invitation.inviterName}
                        </span>{" "}
                        vous invite sur Réglo.{" "}
                    </>
                )}
                Créez votre compte{" "}
                <span className="font-medium wrap-break-word text-ink">
                    {invitation.email}
                </span>
                , avec le rôle{" "}
                <span className="font-medium text-ink">
                    {ROLE_LABELS[invitation.role]}
                </span>{" "}
                : {ROLE_DESCRIPTIONS[invitation.role].toLowerCase()}
            </AuthHeading>
            <AcceptInvitationForm
                token={token as string}
                invitation={invitation}
            />
        </>
    );
}

function InvitationSkeleton() {
    return (
        <div className="flex flex-col gap-5" aria-busy="true">
            <span className="sr-only">Chargement…</span>
            <Skeleton className="mx-auto h-8 w-2/3" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
        </div>
    );
}
