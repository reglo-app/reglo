"use client";

import { useMemo, useState, useTransition } from "react";
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    LoaderCircle,
    MoreVertical,
    Search,
    UserMinus,
} from "lucide-react";
import { toast } from "sonner";

import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
    ROLE_KEYS,
    ROLE_LABELS,
    type Member,
    type RoleKey,
} from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { changeMemberRole, removeMember } from "@/lib/team/actions";
import { cn } from "@/lib/utils";

export const PAGE_SIZE = 10;

/** Role and removal items of the row menu: one size, pointer cursor. */
const MENU_ITEM =
    "min-h-9 cursor-pointer gap-2 py-1.5 pl-2.5 text-sm [&_svg:not([class*='size-'])]:size-4";

/** A colour per role; the badge always says the role in words. */
const ROLE_BADGES = {
    admin: "success",
    member: "info",
    reader: "secondary",
} as const satisfies Record<RoleKey, string>;

type SortKey = "lastSeenAt" | "joinedAt";
type Sort = { key: SortKey; direction: "asc" | "desc" };

export function memberName(
    member: Pick<Member, "firstName" | "lastName" | "email">,
) {
    return (
        [member.firstName, member.lastName].filter(Boolean).join(" ") ||
        member.email
    );
}

/** Lowercase and without accents: "Inès" is found with "ines". */
function normalize(text: string): string {
    return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Dates in the chosen order; members without date always last. */
function compareDates(
    a: string | null,
    b: string | null,
    direction: Sort["direction"],
): number {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    const order = Date.parse(a) - Date.parse(b);
    return direction === "asc" ? order : -order;
}

export type MemberTableProps = {
    members: Member[];
    currentUserId: string;
    /** Administrators select, change roles and remove (the API checks). */
    canManage?: boolean;
    /** Shown at the right of the search field (the invite button). */
    action?: React.ReactNode;
    /** Injected in tests; the server actions by default. */
    changeRole?: typeof changeMemberRole;
    remove?: typeof removeMember;
};

/**
 * Members of the organization (US-03, US-16): search, sort on the dates,
 * pages of PAGE_SIZE. Nobody manages their own row: changing one's own role
 * or leaving is not done here (US-04).
 */
export function MemberTable({
    members,
    currentUserId,
    canManage = false,
    action,
    changeRole = changeMemberRole,
    remove = removeMember,
}: MemberTableProps) {
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<Sort | null>(null);
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    // Shown at once, before the API answers (back on refusal).
    const [roles, setRoles] = useState<Record<string, RoleKey>>({});
    const [toRemove, setToRemove] = useState<Member[]>([]);
    const [isRemoving, startRemoving] = useTransition();

    const visible = useMemo(() => {
        const words = normalize(query.trim());
        const found = words
            ? members.filter((member) =>
                  normalize(`${memberName(member)} ${member.email}`).includes(
                      words,
                  ),
              )
            : members;
        return sort
            ? [...found].sort((a, b) =>
                  compareDates(a[sort.key], b[sort.key], sort.direction),
              )
            : found;
    }, [members, query, sort]);

    const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const currentPage = Math.min(page, pageCount);
    const rows = visible.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
    );

    const canSelect = (member: Member) =>
        canManage && member.id !== currentUserId;
    const selectableRows = rows.filter(canSelect);
    // Members removed meanwhile are no longer selected.
    const selectedMembers = members.filter(
        (member) => selected.has(member.id) && canSelect(member),
    );
    const allRowsSelected =
        selectableRows.length > 0 &&
        selectableRows.every((member) => selected.has(member.id));
    const someRowsSelected =
        !allRowsSelected &&
        selectableRows.some((member) => selected.has(member.id));

    function toggle(ids: string[], checked: boolean) {
        setSelected((previous) => {
            const next = new Set(previous);
            for (const id of ids) {
                if (checked) next.add(id);
                else next.delete(id);
            }
            return next;
        });
    }

    function sortBy(key: SortKey) {
        // Most recent first, then the other way.
        setSort((previous) =>
            previous?.key === key && previous.direction === "desc"
                ? { key, direction: "asc" }
                : { key, direction: "desc" },
        );
        setPage(1);
    }

    function chooseRole(member: Member, role: RoleKey) {
        const previous = roles[member.id] ?? member.role;
        if (role === previous) return;
        setRoles((current) => ({ ...current, [member.id]: role }));
        void changeRole(member.id, role, memberName(member)).then((result) => {
            if (result.error) {
                setRoles((current) => ({ ...current, [member.id]: previous }));
                toast.error(result.error);
            } else if (result.done) {
                toast.success(result.done);
            }
        });
    }

    function confirmRemoval() {
        startRemoving(async () => {
            const removed: string[] = [];
            for (const member of toRemove) {
                const result = await remove(member.id, memberName(member));
                if (result.error) {
                    toast.error(result.error);
                } else {
                    removed.push(member.id);
                }
            }
            if (removed.length === 1) {
                const member = toRemove.find((m) => m.id === removed[0]);
                toast.success(
                    `${member ? memberName(member) : "Le membre"} ne fait plus partie de l'équipe.`,
                );
            } else if (removed.length > 1) {
                toast.success(
                    `${removed.length} membres ne font plus partie de l'équipe.`,
                );
            }
            toggle(removed, false);
            setToRemove([]);
        });
    }

    return (
        <div className="flex flex-col">
            <div className="flex flex-col gap-3 border-b border-border px-5 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold">
                    Membres{" "}
                    <span className="text-ink/70">({members.length})</span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                    {selectedMembers.length > 0 && (
                        <Button
                            variant="destructive-outline"
                            onClick={() => setToRemove(selectedMembers)}
                        >
                            <UserMinus aria-hidden="true" />
                            Retirer ({selectedMembers.length})
                        </Button>
                    )}
                    <div className="relative w-full sm:w-64">
                        <Search
                            aria-hidden="true"
                            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
                        />
                        <Input
                            type="search"
                            aria-label="Rechercher un membre"
                            placeholder="Rechercher"
                            value={query}
                            onChange={(event) => {
                                setQuery(event.target.value);
                                setPage(1);
                            }}
                            // Border of the outline buttons, height of the
                            // invite button next to it; focus of Input kept.
                            className="border-border pl-9 shadow-none"
                        />
                    </div>
                    {action}
                </div>
            </div>

            {/* The number of results, read after each search. */}
            <p className="sr-only" role="status">
                {query.trim()
                    ? `${visible.length} membre${visible.length > 1 ? "s" : ""} trouvé${visible.length > 1 ? "s" : ""}`
                    : ""}
            </p>

            <Table>
                {/* Background on thead: the header row never changes on hover. */}
                <TableHeader className="bg-surface-subtle">
                    <TableRow>
                        {canManage && (
                            <TableHead className="w-12 pl-5">
                                <Checkbox
                                    aria-label="Sélectionner les membres de la page"
                                    checked={allRowsSelected}
                                    indeterminate={someRowsSelected}
                                    disabled={selectableRows.length === 0}
                                    onChange={(event) =>
                                        toggle(
                                            selectableRows.map((m) => m.id),
                                            event.target.checked,
                                        )
                                    }
                                />
                            </TableHead>
                        )}
                        <TableHead className={cn(!canManage && "pl-5")}>
                            Membre
                        </TableHead>
                        <TableHead>Rôle</TableHead>
                        <SortableHead
                            label="Dernière activité"
                            sortKey="lastSeenAt"
                            sort={sort}
                            onSort={sortBy}
                        />
                        <SortableHead
                            label="Inscrit le"
                            sortKey="joinedAt"
                            sort={sort}
                            onSort={sortBy}
                        />
                        {canManage && (
                            <TableHead className="w-14 pr-5">
                                <span className="sr-only">Actions</span>
                            </TableHead>
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.length === 0 && (
                        <TableRow>
                            <TableCell
                                colSpan={canManage ? 6 : 4}
                                className="px-5 text-center text-ink-muted"
                            >
                                Aucun membre ne correspond à « {query.trim()} ».
                            </TableCell>
                        </TableRow>
                    )}
                    {rows.map((member) => {
                        const name = memberName(member);
                        const role = roles[member.id] ?? member.role;
                        const isSelected = selected.has(member.id);
                        return (
                            <TableRow
                                key={member.id}
                                data-state={isSelected ? "selected" : undefined}
                            >
                                {canManage && (
                                    <TableCell className="pl-5">
                                        {canSelect(member) && (
                                            <Checkbox
                                                aria-label={`Sélectionner ${name}`}
                                                checked={isSelected}
                                                onChange={(event) =>
                                                    toggle(
                                                        [member.id],
                                                        event.target.checked,
                                                    )
                                                }
                                            />
                                        )}
                                    </TableCell>
                                )}
                                <TableCell className={cn(!canManage && "pl-5")}>
                                    <div className="flex items-center gap-3">
                                        <UserAvatar
                                            user={member}
                                            fullName={name}
                                        />
                                        <div className="flex min-w-0 flex-col">
                                            <span className="font-medium text-ink">
                                                {name}
                                                {member.id ===
                                                    currentUserId && (
                                                    <span className="font-normal text-ink-muted">
                                                        {" "}
                                                        (vous)
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-ink-muted">
                                                {member.email}
                                            </span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={ROLE_BADGES[role]}>
                                        {ROLE_LABELS[role]}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-ink-muted">
                                    {member.lastSeenAt
                                        ? formatDate(member.lastSeenAt)
                                        : "Jamais"}
                                </TableCell>
                                <TableCell className="text-ink-muted">
                                    {member.joinedAt ? (
                                        formatDate(member.joinedAt)
                                    ) : (
                                        <Badge variant="warning">
                                            Activation en attente
                                        </Badge>
                                    )}
                                </TableCell>
                                {canManage && (
                                    <TableCell className="pr-5 text-right">
                                        {canSelect(member) && (
                                            <RowMenu
                                                name={name}
                                                role={role}
                                                onRole={(next) =>
                                                    chooseRole(member, next)
                                                }
                                                onRemove={() =>
                                                    setToRemove([member])
                                                }
                                            />
                                        )}
                                    </TableCell>
                                )}
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>

            {pageCount > 1 && (
                <Pagination
                    page={currentPage}
                    pageCount={pageCount}
                    onPage={setPage}
                />
            )}

            <Dialog
                open={toRemove.length > 0}
                onOpenChange={(open) => {
                    if (!open && !isRemoving) setToRemove([]);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {toRemove.length === 1
                                ? `Retirer ${memberName(toRemove[0])} de l'équipe ?`
                                : `Retirer ${toRemove.length} membres de l'équipe ?`}
                        </DialogTitle>
                        <DialogDescription>
                            {toRemove.length === 1
                                ? "Son compte est supprimé : cette personne ne pourra plus se connecter."
                                : "Leurs comptes sont supprimés : ces personnes ne pourront plus se connecter."}{" "}
                            Vous pourrez les inviter à nouveau.
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
                            Retirer de l&apos;équipe
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function SortableHead({
    label,
    sortKey,
    sort,
    onSort,
}: {
    label: string;
    sortKey: SortKey;
    sort: Sort | null;
    onSort: (key: SortKey) => void;
}) {
    const direction = sort?.key === sortKey ? sort.direction : null;
    const Icon =
        direction === "asc"
            ? ArrowUp
            : direction === "desc"
              ? ArrowDown
              : ArrowUpDown;

    return (
        <TableHead
            aria-sort={
                direction === "asc"
                    ? "ascending"
                    : direction === "desc"
                      ? "descending"
                      : "none"
            }
        >
            <button
                type="button"
                onClick={() => onSort(sortKey)}
                className="inline-flex items-center gap-1 rounded-sm uppercase transition-colors hover:text-ink"
            >
                {label}
                <Icon aria-hidden="true" className="size-3.5" />
            </button>
        </TableHead>
    );
}

function RowMenu({
    name,
    role,
    onRole,
    onRemove,
}: {
    name: string;
    role: RoleKey;
    onRole: (role: RoleKey) => void;
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
            <DropdownMenuContent align="end" className="w-56">
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
                <DropdownMenuItem
                    variant="destructive"
                    onSelect={onRemove}
                    className={cn(MENU_ITEM, "pr-2.5")}
                >
                    <UserMinus aria-hidden="true" />
                    Retirer de l&apos;équipe
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function Pagination({
    page,
    pageCount,
    onPage,
}: {
    page: number;
    pageCount: number;
    onPage: (page: number) => void;
}) {
    return (
        <nav
            aria-label="Pages des membres"
            className="flex items-center justify-center gap-1 border-t border-border px-5 py-3"
        >
            <Button
                variant="ghost"
                size="icon"
                aria-label="Page précédente"
                disabled={page === 1}
                onClick={() => onPage(page - 1)}
            >
                <ChevronLeft aria-hidden="true" />
            </Button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map(
                (number) => (
                    <Button
                        key={number}
                        variant={number === page ? "secondary" : "ghost"}
                        size="icon"
                        aria-label={`Page ${number}`}
                        aria-current={number === page ? "page" : undefined}
                        onClick={() => onPage(number)}
                    >
                        {number}
                    </Button>
                ),
            )}
            <Button
                variant="ghost"
                size="icon"
                aria-label="Page suivante"
                disabled={page === pageCount}
                onClick={() => onPage(page + 1)}
            >
                <ChevronRight aria-hidden="true" />
            </Button>
        </nav>
    );
}
