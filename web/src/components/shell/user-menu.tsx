"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, UserRound } from "lucide-react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/profile/user-avatar";
import type { CurrentUser } from "@/lib/api";
import { logout } from "@/lib/auth/actions";

export type UserMenuProps = {
    fullName: string;
    roleLabel: string;
    /** null until the account belongs to an organization (US-01). */
    organizationName: string | null;
    /** Profile photo; the initials without it. */
    avatar?: Pick<CurrentUser, "id" | "avatarVersion">;
};

const NO_AVATAR = { id: "", avatarVersion: null };

export function UserMenu({
    fullName,
    roleLabel,
    organizationName,
    avatar = NO_AVATAR,
}: UserMenuProps) {
    const [isLoggingOut, startLogout] = useTransition();

    return (
        // Not modal: opening the menu must not lock the page scroll (that
        // hid the scrollbar and shifted the layout).
        <DropdownMenu modal={false}>
            {/* Round avatar and chevron only; name, role and organization
                are in the menu. */}
            <DropdownMenuTrigger
                aria-label={
                    organizationName
                        ? `Menu de ${fullName}, ${organizationName}`
                        : `Menu de ${fullName}`
                }
                className="pl-1 flex items-center gap-1 rounded-full py-0.75 px-0.5 pr-1.5 transition-[background-color,box-shadow] hover:bg-brand-green/10 aria-expanded:bg-green-50 duration-200"
            >
                <UserAvatar user={avatar} fullName={fullName} />
                <ChevronDown
                    aria-hidden="true"
                    className="size-4 text-ink-muted"
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                    <span className="block text-sm font-medium text-ink">
                        {fullName}
                    </span>
                    <span className="block text-xs text-ink-muted">
                        {organizationName
                            ? `${roleLabel} · ${organizationName}`
                            : roleLabel}
                    </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/settings">
                        <UserRound aria-hidden="true" />
                        Mon profil
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                    disabled={isLoggingOut}
                    onSelect={() => startLogout(() => logout())}
                >
                    <LogOut aria-hidden="true" />
                    Se déconnecter
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
