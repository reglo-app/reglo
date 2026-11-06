import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import {
    CurrentUserMenu,
    CurrentUserMenuSkeleton,
} from "@/components/shell/current-user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { orNotFoundWhenRefused } from "@/lib/admin/access";
import { api } from "@/lib/api";

export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

/**
 * Reserved to the REGLO team: the API refuses anybody else, who then sees
 * the "not found" page, without the menus of the back office.
 */
async function BackOfficeShell({ children }: { children: React.ReactNode }) {
    await orNotFoundWhenRefused(api.getAdminTeam());

    return (
        <div className="flex min-h-screen w-full flex-col">
            <a
                href="#main-content"
                className="sr-only z-50 rounded-md bg-brand-teal px-4 py-3 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
            >
                Aller au contenu
            </a>
            {/* Fixed on large screens only: on a phone, it takes three rows. */}
            <header className="z-40 flex flex-wrap lg:sticky lg:top-0 items-center gap-x-6 gap-y-2 border-b border-border bg-white px-4 py-3 sm:px-6">
                <Link
                    href="/admin"
                    className="flex min-h-10 items-center gap-2 rounded-md"
                >
                    <Image
                        src="/brand/reglo-symbol.png"
                        alt=""
                        width={36}
                        height={28}
                        priority
                    />
                    <span className="font-display text-2xl font-extrabold text-brand-teal">
                        REGLO
                    </span>
                    <span className="text-sm font-medium text-ink-muted">
                        Back office
                    </span>
                </Link>
                <div className="order-last w-full lg:order-none lg:w-auto">
                    <AdminNav />
                </div>
                <div className="ml-auto">
                    <Suspense fallback={<CurrentUserMenuSkeleton />}>
                        <CurrentUserMenu />
                    </Suspense>
                </div>
            </header>
            <main
                id="main-content"
                tabIndex={-1}
                className="w-full flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8"
            >
                {children}
            </main>
        </div>
    );
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <Suspense
            fallback={
                <div className="flex flex-col gap-6 p-6" aria-busy="true">
                    <span className="sr-only">Chargement…</span>
                    <Skeleton className="h-16 rounded-lg" />
                    <Skeleton className="h-72 rounded-lg" />
                </div>
            }
        >
            <BackOfficeShell>{children}</BackOfficeShell>
        </Suspense>
    );
}
