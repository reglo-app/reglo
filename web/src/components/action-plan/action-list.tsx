import Link from "next/link";
import { ChevronRight, ListChecks, Plus } from "lucide-react";

import { DomainBadge } from "@/components/domain-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { personName, STATUS_LABELS } from "@/lib/action-plan/labels";
import type { Action, ActionStatus } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

const STATUS_VARIANTS = {
    todo: "outline",
    in_progress: "info",
    in_review: "warning",
    done: "success",
} as const satisfies Record<ActionStatus, string>;

/** The status in words (charter: never the colour alone). */
export function StatusBadge({ status }: { status: ActionStatus }) {
    return (
        <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
    );
}

/** Late or due soon, in words (charter: never the colour alone). */
export function DueBadge({ action }: { action: Action }) {
    if (action.isOverdue) {
        return <Badge variant="destructive">En retard</Badge>;
    }
    if (action.isDueSoon) {
        return <Badge variant="warning">Échéance proche</Badge>;
    }
    return null;
}

/** Actions of the organization, in the order of the API. */
export function ActionList({ actions }: { actions: Action[] }) {
    return (
        <Card className="gap-0 py-0">
            <ul className="divide-y divide-border">
                {actions.map((action) => (
                    <li key={action.id}>
                        <Link
                            href={`/actions/${action.id}`}
                            className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-green-50/40 focus-visible:bg-green-50/40 sm:px-6"
                        >
                            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                                <span className="font-medium text-ink">
                                    {action.title}
                                </span>
                                <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-ink-muted">
                                    <DomainBadge domain={action.domain} />
                                    <span>
                                        {action.assignee
                                            ? personName(action.assignee)
                                            : "Sans responsable"}
                                    </span>
                                    <span>
                                        Échéance : {formatDate(action.dueDate)}
                                    </span>
                                    <DueBadge action={action} />
                                </span>
                            </span>
                            <StatusBadge status={action.status} />
                            <ChevronRight
                                aria-hidden="true"
                                className="size-4 shrink-0 text-ink-muted"
                            />
                        </Link>
                    </li>
                ))}
            </ul>
        </Card>
    );
}

/** The filters hide every action. */
export function NoMatchingAction() {
    return (
        <Card>
            <CardContent className="py-8 text-center text-ink-muted">
                Aucune action ne correspond à ces filtres.
            </CardContent>
        </Card>
    );
}

/** No action yet: the way to the first one. */
export function NoAction({ canEdit }: { canEdit: boolean }) {
    return (
        <Card>
            <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <ListChecks
                    aria-hidden="true"
                    className="size-8 text-green-700"
                />
                <h2 className="text-lg font-semibold">
                    Aucune action pour l&apos;instant
                </h2>
                <p className="max-w-md text-ink-muted">
                    Les actions prioritaires du résultat de votre diagnostic
                    sont un bon point de départ.
                </p>
                {canEdit && (
                    <Button asChild>
                        <Link href="/actions/nouvelle">
                            <Plus aria-hidden="true" />
                            Nouvelle action
                        </Link>
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
