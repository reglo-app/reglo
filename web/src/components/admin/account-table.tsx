"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
    LoaderCircle,
    MoreVertical,
    RotateCw,
    Search,
    UserMinus,
} from "lucide-react";
import { toast } from "sonner";

import { useTableSearch } from "@/components/admin/use-table-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { memberName, Pagination } from "@/components/team/member-table";
import {
    changeUserRole,
    removeAccount,
    resendActivation,
} from "@/lib/admin/actions";
import {
    ROLE_KEYS,
    ROLE_LABELS,
    type AdminUser,
    type RoleKey,
} from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const MENU_ITEM =
    "min-h-9 cursor-pointer gap-2 py-1.5 pl-2.5 text-sm [&_svg:not([class*='size-'])]:size-4";

const ROLE_BADGES = {
    admin: "success",
    member: "info",
    reader: "secondary",
} as const satisfies Record<RoleKey, string>;

const textOf = (account: AdminUser) =>
    `${memberName(account)} ${account.email} ${account.organization?.name ?? ""}`;

export type AccountTableProps = {
    title: string;
    accounts: AdminUser[];
    /** Accounts of the REGLO team: no role, and nobody removes themself. */
    team?: boolean;
    /** Adds a column with a link to the organization of each account. */
    showOrganization?: boolean;
    /** The REGLO team member using the page: no menu on their own row. */
    currentUserId?: string;
    /** Shown at the right of the search field (the add button). */
    action?: React.ReactNode;
    /** Injected in tests; the server actions by default. */
    changeRole?: typeof changeUserRole;
    remove?: typeof removeAccount;
    resend?: typeof resendActivation;
};

/** Accounts in the back office: search, role, new link, removal. */
export function AccountTable({
    title,
    accounts,
    team = false,
    showOrganization = false,
    currentUserId,
    action,
    changeRole = changeUserRole,
    remove = removeAccount,
    resend = resendActivation,
}: AccountTableProps) {
    const table = useTableSearch(accounts, textOf);
    // Shown at once, before the API answers (back on refusal).
    const [roles, setRoles] = useState<Record<string, RoleKey>>({});
    const [toRemove, setToRemove] = useState<AdminUser | null>(null);
    const [isRemoving, startRemoving] = useTransition();

    const hasRole = (account: AdminUser) =>
        !team && account.organization !== null;

    function chooseRole(account: AdminUser, role: RoleKey) {
        const previous = roles[account.id] ?? account.role;
        if (role === previous) return;
        setRoles((current) => ({ ...current, [account.id]: role }));
        void changeRole(account.id, role, memberName(account)).then(
            (result) => {
                if (result.error) {
                    setRoles((current) => ({
                        ...current,
                        [account.id]: previous,
                    }));
                    toast.error(result.error);
                } else if (result.done) {
                    toast.success(result.done);
                }
            },
        );
    }

    function sendLink(account: AdminUser) {
        void resend(account.id, account.email).then((result) => {
            if (result.error) toast.error(result.error);
            else if (result.done) toast.success(result.done);
        });
    }

    function confirmRemoval() {
        if (!toRemove) return;
        startRemoving(async () => {
            const result = await remove(
                toRemove.id,
                memberName(toRemove),
                team,
            );
            if (result.error) toast.error(result.error);
            else if (result.done) toast.success(result.done);
            setToRemove(null);
        });
    }

    const columnCount = showOrganization ? 5 : 4;

    return (
        <div className="flex flex-col">
            <div className="flex flex-col gap-3 border-b border-border px-5 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold">
                    {title}{" "}
                    <span className="text-ink/70">({accounts.length})</span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full sm:w-64">
                        <Search
                            aria-hidden="true"
                            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
                        />
                        <Input
                            type="search"
                            aria-label="Rechercher un compte"
                            placeholder="Rechercher"
                            value={table.query}
                            onChange={(event) =>
                                table.search(event.target.value)
                            }
                            className="border-border pl-9 shadow-none"
                        />
                    </div>
                    {action}
                </div>
            </div>

            <p className="sr-only" role="status">
                {table.query.trim()
                    ? `${table.found.length} compte${table.found.length > 1 ? "s" : ""} trouvé${table.found.length > 1 ? "s" : ""}`
                    : ""}
            </p>

            <Table>
                <TableHeader className="bg-surface-subtle">
                    <TableRow>
                        <TableHead className="pl-5">Compte</TableHead>
                        {showOrganization && (
                            <TableHead>Organisation</TableHead>
                        )}
                        {!team && <TableHead>Rôle</TableHead>}
                        <TableHead>Dernière activité</TableHead>
                        {team && <TableHead>Inscrit le</TableHead>}
                        <TableHead className="w-14 pr-5">
                            <span className="sr-only">Actions</span>
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {table.rows.length === 0 && (
                        <TableRow>
                            <TableCell
                                colSpan={columnCount}
                                className="px-5 text-center text-ink-muted"
                            >
                                {table.query.trim()
                                    ? `Aucun compte ne correspond à « ${table.query.trim()} ».`
                                    : "Aucun compte pour le moment."}
                            </TableCell>
                        </TableRow>
                    )}
                    {table.rows.map((account) => {
                        const name = memberName(account);
                        const role = roles[account.id] ?? account.role;
                        const isSelf = account.id === currentUserId;
                        return (
                            <TableRow key={account.id}>
                                <TableCell className="pl-5">
                                    <div className="flex min-w-0 flex-col">
                                        <span className="font-medium text-ink">
                                            {name}
                                            {isSelf && (
                                                <span className="font-normal text-ink-muted">
                                                    {" "}
                                                    (vous)
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-ink-muted">
                                            {account.email}
                                        </span>
                                    </div>
                                </TableCell>
                                {showOrganization && (
                                    <TableCell>
                                        {account.organization ? (
                                            <Link
                                                href={`/admin/organisations/${account.organization.id}`}
                                                className="link-underline text-green-700"
                                            >
                                                {account.organization.name}
                                            </Link>
                                        ) : (
                                            <span className="text-ink-muted">
                                                Aucune
                                            </span>
                                        )}
                                    </TableCell>
                                )}
                                {!team && (
                                    <TableCell>
                                        {hasRole(account) ? (
                                            <Badge variant={ROLE_BADGES[role]}>
                                                {ROLE_LABELS[role]}
                                            </Badge>
                                        ) : (
                                            <span className="text-ink-muted">
                                                Aucun
                                            </span>
                                        )}
                                    </TableCell>
                                )}
                                <TableCell className="text-ink-muted">
                                    {!account.activated ? (
                                        <Badge variant="warning">
                                            Activation en attente
                                        </Badge>
                                    ) : account.lastSeenAt ? (
                                        formatDate(account.lastSeenAt)
                                    ) : (
                                        "Jamais"
                                    )}
                                </TableCell>
                                {team && (
                                    <TableCell className="text-ink-muted">
                                        {account.joinedAt
                                            ? formatDate(account.joinedAt)
                                            : "—"}
                                    </TableCell>
                                )}
                                <TableCell className="pr-5 text-right">
                                    {!isSelf && (
                                        <RowMenu
                                            name={name}
                                            role={
                                                hasRole(account) ? role : null
                                            }
                                            onRole={(next) =>
                                                chooseRole(account, next)
                                            }
                                            onResend={
                                                account.activated
                                                    ? null
                                                    : () => sendLink(account)
                                            }
                                            onRemove={() =>
                                                setToRemove(account)
                                            }
                                        />
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>

            {table.pageCount > 1 && (
                <Pagination
                    page={table.page}
                    pageCount={table.pageCount}
                    onPage={table.setPage}
                    label="Pages des comptes"
                />
            )}

            <Dialog
                open={toRemove !== null}
                onOpenChange={(open) => {
                    if (!open && !isRemoving) setToRemove(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Supprimer le compte de{" "}
                            {toRemove && memberName(toRemove)} ?
                        </DialogTitle>
                        <DialogDescription>
                            Cette personne ne pourra plus se connecter. Vous
                            pourrez lui créer un nouveau compte avec la même
                            adresse.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline" disabled={isRemoving}>
                                Annuler
                            </Button>
                        </DialogClose>
                        <Button
                            variant="destructive"
                            disabled={isRemoving}
                            onClick={confirmRemoval}
                        >
                            {isRemoving && (
                                <LoaderCircle
                                    aria-hidden="true"
                                    className="animate-spin"
                                />
                            )}
                            Supprimer le compte
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function RowMenu({
    name,
    role,
    onRole,
    onResend,
    onRemove,
}: {
    name: string;
    /** null: the account has no role to change. */
    role: RoleKey | null;
    onRole: (role: RoleKey) => void;
    /** null: the account is activated, no link to send. */
    onResend: (() => void) | null;
    onRemove: () => void;
}) {
    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Actions pour ${name}`}
                >
                    <MoreVertical aria-hidden="true" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
                {role !== null && (
                    <>
                        <DropdownMenuLabel>Rôle</DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                            value={role}
                            onValueChange={(value) => onRole(value as RoleKey)}
                        >
                            {ROLE_KEYS.map((key) => (
                                <DropdownMenuRadioItem
                                    key={key}
                                    value={key}
                                    className={cn(MENU_ITEM, "pr-8")}
                                >
                                    {ROLE_LABELS[key]}
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                    </>
                )}
                {onResend && (
                    <DropdownMenuItem
                        onSelect={onResend}
                        className={cn(MENU_ITEM, "pr-2.5")}
                    >
                        <RotateCw aria-hidden="true" />
                        Renvoyer le lien d&apos;activation
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem
                    variant="destructive"
                    onSelect={onRemove}
                    className={cn(MENU_ITEM, "pr-2.5")}
                >
                    <UserMinus aria-hidden="true" />
                    Supprimer le compte
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
