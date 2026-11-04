import { Check } from "lucide-react";

import { StatusControl } from "@/components/action-plan/action-controls";
import { StatusBadge } from "@/components/action-plan/action-list";
import { DomainBadge } from "@/components/domain-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    personName,
    STATUS_LABELS,
    TYPE_LABELS,
} from "@/lib/action-plan/labels";
import {
    ACTION_STATUSES,
    type ActionDetail,
    type ActionStatusChange,
} from "@/lib/api/types";
import { formatDate, formatDueIn } from "@/lib/format";
import { cn } from "@/lib/utils";

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
});

/**
 * One action (US-09): what to do, who, by when, its status with the way to
 * move it, and the history of its status changes.
 */
export function ActionDetailView({
    action,
    canChangeStatus,
    today,
}: {
    action: ActionDetail;
    /** The assignee or an administrator (same rule as the API). */
    canChangeStatus: boolean;
    /** "YYYY-MM-DD", for "En retard de 3 jours". */
    today: string;
}) {
    const current = ACTION_STATUSES.indexOf(action.status);

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card>
                <CardContent className="flex flex-col gap-5">
                    <h2 className="text-lg font-semibold">Détails</h2>
                    <dl className="grid gap-4 sm:grid-cols-2">
                        <Item label="Domaine">
                            <DomainBadge domain={action.domain} />
                        </Item>
                        <Item label="Type">{TYPE_LABELS[action.type]}</Item>
                        <Item label="Responsable">
                            {action.assignee ? (
                                personName(action.assignee)
                            ) : (
                                <span className="text-ink-muted">
                                    Aucun : la personne a quitté
                                    l&apos;organisation.
                                </span>
                            )}
                        </Item>
                        <Item label="Échéance">
                            {formatDate(action.dueDate)}
                            {action.status !== "done" && (
                                <span className="block text-sm text-ink-muted">
                                    {formatDueIn(action.dueDate, today)}
                                </span>
                            )}
                        </Item>
                    </dl>
                    <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-medium text-ink-muted">
                            Description
                        </h3>
                        <p className="whitespace-pre-line">
                            {action.description || (
                                <span className="text-ink-muted">
                                    Pas de description.
                                </span>
                            )}
                        </p>
                    </div>
                    <p className="text-sm text-ink-muted">
                        Créée le {formatDate(action.createdAt)}
                        {action.createdBy &&
                            ` par ${personName(action.createdBy)}`}
                    </p>
                </CardContent>
            </Card>

            <div className="flex flex-col gap-6">
                <Card>
                    <CardContent className="flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-lg font-semibold">Statut</h2>
                            <StatusBadge status={action.status} />
                        </div>
                        <ol className="flex flex-col gap-2">
                            {ACTION_STATUSES.map((status, index) => (
                                <li
                                    key={status}
                                    aria-current={
                                        index === current ? "step" : undefined
                                    }
                                    className={cn(
                                        "flex items-center gap-3 text-sm",
                                        index > current && "text-ink-muted",
                                        index === current && "font-semibold",
                                    )}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                                            index < current &&
                                                "border-green-700 bg-green-700 text-white",
                                            index === current &&
                                                "border-green-700 text-green-700",
                                            index > current &&
                                                "border-border-strong",
                                        )}
                                    >
                                        {index < current ? (
                                            <Check className="size-3.5" />
                                        ) : (
                                            index + 1
                                        )}
                                    </span>
                                    {STATUS_LABELS[status]}
                                    {index < current && (
                                        <span className="sr-only">
                                            {" "}
                                            (étape passée)
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ol>
                        {canChangeStatus ? (
                            <StatusControl
                                actionId={action.id}
                                status={action.status}
                            />
                        ) : (
                            <p className="text-sm text-ink-muted">
                                Seuls le responsable de l&apos;action et les
                                administrateurs peuvent changer son statut.
                            </p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="flex flex-col gap-4">
                        <h2 className="text-lg font-semibold">Historique</h2>
                        <ol className="flex flex-col gap-3">
                            {[...action.history].reverse().map((change) => (
                                <li
                                    key={`${change.at}-${change.to}`}
                                    className="flex flex-col gap-0.5 border-l-2 border-border pl-3"
                                >
                                    <span>{describe(change)}</span>
                                    <span className="text-sm text-ink-muted">
                                        {formatDate(change.at)} à{" "}
                                        {timeFormatter.format(
                                            new Date(change.at),
                                        )}
                                        {change.by
                                            ? ` par ${personName(change.by)}`
                                            : " par un ancien membre"}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function describe(change: ActionStatusChange): string {
    if (change.from === null) return "Action créée";
    return `Passée à « ${STATUS_LABELS[change.to]} » (avant : « ${STATUS_LABELS[change.from]} »)`;
}

function Item({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1">
            <dt className="text-sm font-medium text-ink-muted">{label}</dt>
            <dd>{children}</dd>
        </div>
    );
}
