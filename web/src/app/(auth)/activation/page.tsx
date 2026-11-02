import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert } from "lucide-react";

import { ActivationForm } from "@/components/auth/activation-form";
import { AuthHeading, AuthLayout } from "@/components/auth/auth-layout";
import { ResendActivationForm } from "@/components/auth/resend-activation-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { checkActivationToken } from "@/lib/auth/api";

export const metadata: Metadata = {
    title: "Activation du compte",
    // The URL holds a secret token: never send it to other sites.
    referrer: "no-referrer",
};

type SearchParams = PageProps<"/activation">["searchParams"];

/** Link of the activation e-mail (US-01): the new user picks a password. */
export default function ActivationPage({
    searchParams,
}: {
    searchParams: SearchParams;
}) {
    return (
        <AuthLayout>
            <Suspense fallback={<ActivationSkeleton />}>
                <ActivationContent searchParams={searchParams} />
            </Suspense>
        </AuthLayout>
    );
}

async function ActivationContent({
    searchParams,
}: {
    searchParams: SearchParams;
}) {
    const { token } = await searchParams;
    const result =
        typeof token === "string" && token
            ? await checkActivationToken(token)
            : ({ status: "invalid" } as const);

    if (result.status === "unavailable") {
        return (
            <>
                <AuthHeading title="Activation du compte" />
                <Alert variant="destructive">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>
                        L&apos;activation est impossible pour le moment.
                        Réessayez plus tard.
                    </AlertDescription>
                </Alert>
            </>
        );
    }

    if (result.status === "invalid") {
        return (
            <>
                <AuthHeading title="Lien expiré">
                    Ce lien d&apos;activation a expiré ou a déjà été utilisé.
                    Saisissez votre adresse e-mail pour en recevoir un nouveau.
                </AuthHeading>
                <ResendActivationForm />
                <p className="mt-6 text-center text-sm text-ink-muted">
                    Compte déjà activé ?{" "}
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

    const { invite } = result;

    return (
        <>
            <AuthHeading
                title={
                    invite.firstName
                        ? `Bienvenue, ${invite.firstName} !`
                        : "Bienvenue !"
                }
            >
                Choisissez le mot de passe de votre compte{" "}
                <span className="font-medium text-ink">{invite.email}</span>
                {invite.organizationName && (
                    <>
                        {" "}
                        pour{" "}
                        <span className="font-medium text-ink">
                            {invite.organizationName}
                        </span>
                    </>
                )}
                .
            </AuthHeading>
            <ActivationForm token={token as string} email={invite.email} />
        </>
    );
}

function ActivationSkeleton() {
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
