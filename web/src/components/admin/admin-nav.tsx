"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Building2, ShieldUser, UsersRound } from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS = [
    { href: "/admin", label: "Organisations", icon: Building2 },
    { href: "/admin/utilisateurs", label: "Utilisateurs", icon: UsersRound },
    { href: "/admin/equipe", label: "Équipe Réglo", icon: ShieldUser },
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
            {/* On a phone, three columns with the icon above the name. */}
            <ul className="grid grid-cols-3 gap-1 sm:flex sm:justify-center">
                {LINKS.map(({ href, label, icon: Icon }) => {
                    const current = isCurrent(href, pathname);
                    return (
                        <li key={href}>
                            <Link
                                href={href}
                                aria-current={current ? "page" : undefined}
                                className={cn(
                                    "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-xs font-medium transition-colors sm:min-h-10 sm:flex-row sm:gap-2 sm:px-3 sm:text-base",
                                    current
                                        ? "bg-green-50 text-ink"
                                        : "text-ink-muted hover:bg-surface-subtle hover:text-ink",
                                )}
                            >
                                <Icon
                                    aria-hidden="true"
                                    className={cn(
                                        "size-4 shrink-0",
                                        current
                                            ? "text-green-700"
                                            : "text-ink-muted",
                                    )}
                                />
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
