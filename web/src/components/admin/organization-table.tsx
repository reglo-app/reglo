"use client";

import Link from "next/link";
import { Search } from "lucide-react";

import { useTableSearch } from "@/components/admin/use-table-search";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/team/member-table";
import type { AdminOrganization } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

const nameOf = (organization: AdminOrganization) => organization.name;

/** Every client of REGLO: search, and a link to each organization. */
export function OrganizationTable({
    organizations,
    action,
}: {
    organizations: AdminOrganization[];
    /** Shown at the right of the search field (the create button). */
    action?: React.ReactNode;
}) {
    const table = useTableSearch(organizations, nameOf);

    return (
        <div className="flex flex-col">
            <div className="flex flex-col gap-3 border-b border-border px-5 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold">
                    Organisations{" "}
                    <span className="text-ink/70">
                        ({organizations.length})
                    </span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full sm:w-64">
                        <Search
                            aria-hidden="true"
                            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
                        />
                        <Input
                            type="search"
                            aria-label="Rechercher une organisation"
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
                    ? `${table.found.length} organisation${table.found.length > 1 ? "s" : ""} trouvée${table.found.length > 1 ? "s" : ""}`
                    : ""}
            </p>

            <Table>
                <TableHeader className="bg-surface-subtle">
                    <TableRow>
                        <TableHead className="pl-5">Organisation</TableHead>
                        <TableHead>Comptes</TableHead>
                        <TableHead>Activations</TableHead>
                        <TableHead className="pr-5">Créée le</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {table.rows.length === 0 && (
                        <TableRow>
                            <TableCell
                                colSpan={4}
                                className="px-5 text-center text-ink-muted"
                            >
                                {table.query.trim()
                                    ? `Aucune organisation ne correspond à « ${table.query.trim()} ».`
                                    : "Aucune organisation pour le moment."}
                            </TableCell>
                        </TableRow>
                    )}
                    {table.rows.map((organization) => (
                        <TableRow key={organization.id}>
                            <TableCell className="pl-5 font-medium">
                                <Link
                                    href={`/admin/organisations/${organization.id}`}
                                    className="link-underline text-green-700"
                                >
                                    {organization.name}
                                </Link>
                            </TableCell>
                            <TableCell>{organization.userCount}</TableCell>
                            <TableCell>
                                {organization.pendingCount > 0 ? (
                                    <Badge variant="warning">
                                        {organization.pendingCount} en attente
                                    </Badge>
                                ) : (
                                    <span className="text-ink-muted">
                                        Aucune en attente
                                    </span>
                                )}
                            </TableCell>
                            <TableCell className="pr-5 text-ink-muted">
                                {formatDate(organization.createdAt)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            {table.pageCount > 1 && (
                <Pagination
                    page={table.page}
                    pageCount={table.pageCount}
                    onPage={table.setPage}
                    label="Pages des organisations"
                />
            )}
        </div>
    );
}
