"use client";

import Link from "next/link";
import {
    Check,
    ChevronsUpDown,
    LayoutDashboard,
    ShieldCheck,
    type LucideIcon,
} from "lucide-react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type InterfaceKey = "admin" | "app";

const INTERFACES: Record<
    InterfaceKey,
    { label: string; href: string; icon: LucideIcon }
> = {
    admin: {
        label: "Interface administrateur",
        href: "/admin",
        icon: ShieldCheck,
    },
    app: {
        label: "Interface utilisateur",
        href: "/dashboard",
        icon: LayoutDashboard,
    },
};

/**
 * REGLO team: shows which interface is open and goes to the other one. The
 * API still checks the access to the back office.
 */
export function InterfaceSwitch({ current }: { current: InterfaceKey }) {
    const { label, icon: Icon } = INTERFACES[current];

    return (
        <DropdownMenu modal={false}>
            {/* On a phone, the icon only: the name stays in the label. */}
            <DropdownMenuTrigger
                aria-label={`${label} : changer d'interface`}
                className="flex min-h-10 shrink-0 items-center gap-2 rounded-md border whitespace-nowrap border-border bg-white px-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-subtle aria-expanded:bg-green-50"
            >
                <Icon aria-hidden="true" className="size-4 text-green-700" />
                <span className="hidden sm:inline">{label}</span>
                <ChevronsUpDown
                    aria-hidden="true"
                    className="size-4 text-ink-muted"
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-60">
                {(Object.keys(INTERFACES) as InterfaceKey[]).map((key) => {
                    const item = INTERFACES[key];
                    const isCurrent = key === current;
                    return (
                        <DropdownMenuItem key={key} asChild>
                            <Link
                                href={item.href}
                                aria-current={isCurrent ? "page" : undefined}
                                className="min-h-9 cursor-pointer gap-2 text-sm whitespace-nowrap"
                            >
                                <item.icon aria-hidden="true" />
                                {item.label}
                                {isCurrent && (
                                    <Check
                                        aria-hidden="true"
                                        className="ml-auto text-green-700"
                                    />
                                )}
                            </Link>
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
