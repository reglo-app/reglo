"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/utils";

const LINKS = [
    { href: "/admin", label: "Organisations" },
    { href: "/admin/utilisateurs", label: "Utilisateurs" },
    { href: "/admin/equipe", label: "Équipe Réglo" },
];

/** The page of an organization belongs to "Organisations". */
function isCurrent(href: string, pathname: string | null): boolean {
    if (pathname === null) return false;
    return href === "/admin"
        ? pathname === "/admin" || pathname.startsWith("/admin/organisations")
        : pathname === href;
}

function AdminNavView({ pathname }: { pathname: string | null }) {
    return (
        <nav aria-label="Navigation du back office">
            <ul className="flex flex-wrap gap-1">
                {LINKS.map(({ href, label }) => {
                    const current = isCurrent(href, pathname);
                    return (
                        <li key={href}>
                            <Link
                                href={href}
                                aria-current={current ? "page" : undefined}
                                className={cn(
                                    "flex min-h-10 items-center rounded-md px-3 text-base font-medium transition-colors",
                                    current
                                        ? "bg-green-50 text-ink"
                                        : "text-ink-muted hover:bg-surface-subtle hover:text-ink",
                                )}
                            >
                                {label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

function AdminNavWithPathname() {
    return <AdminNavView pathname={usePathname()} />;
}

/** The URL is read inside Suspense, like the main navigation. */
export function AdminNav() {
    return (
        <Suspense fallback={<AdminNavView pathname={null} />}>
            <AdminNavWithPathname />
        </Suspense>
    );
}
