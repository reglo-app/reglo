import Link from "next/link";

import { Button } from "@/components/ui/button";

export function NotFoundMessage() {
    return (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
            <h1 className="font-display text-xl font-extrabold tracking-wide text-ink uppercase sm:text-2xl">
                Page introuvable
            </h1>
            <p className="max-w-md text-ink-muted">
                Cette page n&apos;existe pas ou a été déplacée.
            </p>
            <Button asChild>
                <Link href="/dashboard">Retour au tableau de bord</Link>
            </Button>
        </div>
    );
}
