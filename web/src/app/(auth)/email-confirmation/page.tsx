import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert } from "lucide-react";

import { AuthHeading, AuthLayout } from "@/components/auth/auth-layout";
import { EmailConfirmationForm } from "@/components/profile/email-confirmation-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { checkEmailChangeToken } from "@/lib/profile/api";

export const metadata: Metadata = {
    title: "Nouvelle adresse e-mail",
    // The URL holds a secret token: never send it to other sites.
    referrer: "no-referrer",
};

type SearchParams = PageProps<"/email-confirmation">["searchParams"];

/** Link of the e-mail sent to a new address ("Mon profil"). */
export default function EmailConfirmationPage({
    searchParams,
}: {
    searchParams: SearchParams;
}) {
    return (
        <AuthLayout>
            <Suspense fallback={<ConfirmationSkeleton />}>
                <ConfirmationContent searchParams={searchParams} />
            </Suspense>
        </AuthLayout>
    );
}

async function ConfirmationContent({
    searchParams,
}: {
    searchParams: SearchParams;
}) {
    const { token } = await searchParams;
    const result =
        typeof token === "string" && token
            ? await checkEmailChangeToken(token)
            : ({ status: "invalid" } as const);

    if (result.status === "unavailable") {
        return (
            <>
                <AuthHeading title="Nouvelle adresse e-mail" />
                <Alert variant="destructive">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>
                        La confirmation est impossible pour le moment. Réessayez
                        plus tard.
                    </AlertDescription>
                </Alert>
            </>
        );
    }

    if (result.status === "invalid") {
        return (
            <>
                <AuthHeading title="Lien expiré">
                    Ce lien de confirmation a expiré ou a déjà été utilisé.
                    Refaites la demande depuis votre profil.
                </AuthHeading>
                <p className="text-center text-sm text-ink-muted">
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

    return (
        <>
            <AuthHeading title="Nouvelle adresse e-mail">
                Votre compte Réglo utilisera désormais l&apos;adresse{" "}
                <span className="font-medium wrap-break-word text-ink">
                    {result.newEmail}
                </span>
                .
            </AuthHeading>
            <EmailConfirmationForm
                token={token as string}
                newEmail={result.newEmail}
            />
        </>
    );
}

function ConfirmationSkeleton() {
    return (
        <div className="flex flex-col gap-5" aria-busy="true">
            <span className="sr-only">Chargement…</span>
            <Skeleton className="mx-auto h-8 w-2/3" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-11 w-full" />
        </div>
    );
}
