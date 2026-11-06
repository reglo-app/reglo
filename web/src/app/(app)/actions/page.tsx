import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { ActionFilters } from "@/components/action-plan/action-filters";
import {
    ActionList,
    NoAction,
    NoMatchingAction,
} from "@/components/action-plan/action-list";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
    hasActionFilters,
    parseActionFilters,
} from "@/lib/action-plan/filters";
import { api, canEdit } from "@/lib/api";

export const metadata: Metadata = { title: "Plan d'actions" };

type SearchParams = PageProps<"/actions">["searchParams"];

/** Action plan of the organization (US-09), with its filters (US-10). */
async function ActionsContent({
    searchParams,
}: {
    searchParams: SearchParams;
}) {
    const [user, members, params] = await Promise.all([
        api.getCurrentUser(),
        api.getMembers(),
        searchParams,
    ]);
    const filters = parseActionFilters(
        params,
        members.map((member) => member.id),
    );
    const actions = await api.getActions(filters);
    const editable = canEdit(user.role);
    const filtered = hasActionFilters(filters);

    return (
        <>
            <PageHeader
                title="Plan d'actions"
                description={
                    editable
                        ? "Les actions qui améliorent votre score QHSE : qui fait quoi, et pour quand."
                        : "Les actions qui améliorent votre score QHSE. En lecture seule, vous les consultez sans les modifier."
                }
                action={
                    editable &&
                    (actions.length > 0 || filtered) && (
                        <Button asChild>
                            <Link href="/actions/nouvelle">
                                <Plus aria-hidden="true" />
                                Nouvelle action
                            </Link>
                        </Button>
                    )
                }
            />
            {actions.length === 0 && !filtered ? (
                <NoAction canEdit={editable} />
            ) : (
                <div className="flex flex-col gap-4">
                    <ActionFilters
                        filters={filters}
                        // Who can be responsible, and whoever is chosen: a
                        // member who became a reader can still hold actions.
                        assignees={members.filter(
                            (member) =>
                                (member.activated &&
                                    member.role !== "reader") ||
                                member.id === filters.assignee,
                        )}
                        count={actions.length}
                    />
                    {actions.length === 0 ? (
                        <NoMatchingAction />
                    ) : (
                        <ActionList actions={actions} />
                    )}
                </div>
            )}
        </>
    );
}

function ActionsSkeleton() {
    return (
        <div className="flex flex-col gap-6" aria-busy="true">
            <span className="sr-only">Chargement…</span>
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-80 rounded-lg" />
        </div>
    );
}

export default function ActionsPage({ searchParams }: PageProps<"/actions">) {
    return (
        <Suspense fallback={<ActionsSkeleton />}>
            <ActionsContent searchParams={searchParams} />
        </Suspense>
    );
}
