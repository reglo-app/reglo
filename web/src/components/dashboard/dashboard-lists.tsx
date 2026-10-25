import Image from "next/image";
import Link from "next/link";
import { BellRing, ListChecks, Newspaper } from "lucide-react";

import { BlockHeader, EmptyLine } from "@/components/dashboard/block";
import { DomainBadge } from "@/components/domain-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type {
    ActionSummary,
    AlertKind,
    DashboardAlert,
    NewsSummary,
} from "@/lib/api";
import { DOMAIN_ICON_CLASSES, DOMAINS, type DomainKey } from "@/lib/domains";
import { daysUntil, formatDate, formatDueIn } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Coloured domain icon; its name is read by screen readers only. */
function DomainIcon({ domain }: { domain: DomainKey }) {
    const { label, icon: Icon } = DOMAINS[domain];
    return (
        <>
            <Icon
                aria-hidden="true"
                className={cn("size-4 shrink-0", DOMAIN_ICON_CLASSES[domain])}
            />
            <span className="sr-only">{label} : </span>
        </>
    );
}

const ALERT_KIND_LABELS: Record<AlertKind, string> = {
    action_overdue: "Action",
    document_expiring: "Justificatif",
    training_expiring: "Habilitation",
};

/** Block 2, "Qu'est-ce qui presse ?": late or expiring items, max 5. */
export function AlertsCard({
    alerts,
    today,
}: {
    alerts: DashboardAlert[];
    today: string;
}) {
    return (
        <Card>
            <BlockHeader
                icon={BellRing}
                title="Alertes"
                seeAll={{ href: "/actions", label: "alertes" }}
            />
            <CardContent>
                {alerts.length === 0 ? (
                    <EmptyLine>Rien d&apos;urgent.</EmptyLine>
                ) : (
                    <ul className="divide-y divide-border">
                        {alerts.slice(0, 5).map((alert) => {
                            const late = daysUntil(alert.dueDate, today) < 0;
                            return (
                                <li
                                    key={alert.id}
                                    className="flex items-center gap-3 py-2.5"
                                >
                                    <DomainIcon domain={alert.domain} />
                                    <p className="min-w-0 flex-1 truncate text-sm text-ink">
                                        <span className="sr-only">
                                            {ALERT_KIND_LABELS[alert.kind]}{" "}
                                            :{" "}
                                        </span>
                                        {alert.title}
                                    </p>
                                    <Badge
                                        variant={
                                            late ? "destructive" : "warning"
                                        }
                                    >
                                        {formatDueIn(alert.dueDate, today)}
                                    </Badge>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}

/** Block 3, "Que faire ensuite ?": next open actions and on-time rate. */
export function UpcomingActionsCard({
    actions,
    onTimeRate,
    today,
}: {
    actions: ActionSummary[];
    onTimeRate: number | null;
    today: string;
}) {
    return (
        <Card>
            <BlockHeader
                icon={ListChecks}
                title="Prochaines actions"
                extra={
                    onTimeRate !== null && (
                        <Badge
                            variant="success"
                            title="Actions clôturées dans les délais"
                        >
                            {onTimeRate} % à l&apos;heure
                        </Badge>
                    )
                }
                seeAll={{ href: "/actions", label: "plan d'actions" }}
            />
            <CardContent>
                {actions.length === 0 ? (
                    <EmptyLine>Aucune action en cours.</EmptyLine>
                ) : (
                    <ul className="divide-y divide-border">
                        {actions.slice(0, 5).map((action) => (
                            <li
                                key={action.id}
                                className="flex items-center gap-3 py-2.5"
                            >
                                <DomainIcon domain={action.domain} />
                                <p className="min-w-0 flex-1 truncate text-sm text-ink">
                                    {action.title}
                                </p>
                                <span className="shrink-0 text-xs text-ink-muted">
                                    {formatDueIn(action.dueDate, today)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}

const COVER_TONES: Record<DomainKey, string> = {
    quality: "bg-quality-50",
    hygiene: "bg-hygiene-50",
    safety: "bg-safety-50",
    environment: "bg-environment-50",
};

/** Article cover: its image, or a domain-coloured block with the icon. */
function NewsCover({ item }: { item: NewsSummary }) {
    if (item.imageUrl) {
        return (
            <Image
                src={item.imageUrl}
                alt=""
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-cover"
            />
        );
    }
    const Icon = DOMAINS[item.domain].icon;
    return (
        <div
            className={cn(
                "flex size-full items-center justify-center",
                COVER_TONES[item.domain],
            )}
        >
            <Icon
                aria-hidden="true"
                className={cn("size-10", DOMAIN_ICON_CLASSES[item.domain])}
            />
        </div>
    );
}

/** Block 4, "Qu'est-ce qui change pour moi ?": latest regulatory news. */
export function NewsCard({ news }: { news: NewsSummary[] }) {
    return (
        <Card>
            <BlockHeader
                icon={Newspaper}
                title="Veille réglementaire"
                seeAll={{ href: "/news", label: "veille réglementaire" }}
            />
            <CardContent>
                {news.length === 0 ? (
                    <EmptyLine>Aucune nouveauté.</EmptyLine>
                ) : (
                    <ul className="grid gap-4 md:grid-cols-3">
                        {news.slice(0, 3).map((item) => (
                            <li key={item.id}>
                                {/* The whole article opens its page. */}
                                <Link
                                    href={`/news/${item.id}`}
                                    className="group flex flex-col gap-3 rounded-lg"
                                >
                                    <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-subtle">
                                        <div className="size-full transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none">
                                            <NewsCover item={item} />
                                        </div>
                                        <DomainBadge
                                            domain={item.domain}
                                            className="absolute top-3 left-3 bg-white"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <h3 className="line-clamp-2 text-sm font-semibold text-ink group-hover:underline">
                                            {item.title}
                                        </h3>
                                        <p className="text-xs text-ink-muted">
                                            {formatDate(item.publishedAt)}
                                        </p>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
