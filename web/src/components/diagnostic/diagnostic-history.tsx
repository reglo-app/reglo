import Link from "next/link";
import { ArrowRight, ClipboardCheck, Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DiagnosticHistoryEntry } from "@/lib/api/types";
import { roundScore } from "@/lib/diagnostic/result";
import { DOMAIN_KEYS, DOMAINS } from "@/lib/domains";
import { formatDate } from "@/lib/format";

/**
 * The submitted diagnostics, latest first (US-07): date and scores, with
 * a link to the result and to the PDF summary of each one.
 */
export function DiagnosticHistory({
    diagnostics,
    canEdit,
}: {
    diagnostics: DiagnosticHistoryEntry[];
    canEdit: boolean;
}) {
    if (diagnostics.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                    <ClipboardCheck
                        aria-hidden="true"
                        className="size-8 text-green-700"
                    />
                    <h2 className="text-lg font-semibold">
                        Aucun diagnostic validé pour l&apos;instant
                    </h2>
                    <p className="max-w-md text-ink-muted">
                        Chaque diagnostic validé reste ici avec son score : vous
                        mesurez votre progression d&apos;une fois sur
                        l&apos;autre.
                    </p>
                    {canEdit && (
                        <Button asChild>
                            <Link href="/diagnostic">Faire le diagnostic</Link>
                        </Button>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="gap-0 py-0">
            <ul
                aria-label="Diagnostics validés"
                className="divide-y divide-border"
            >
                {diagnostics.map((diagnostic, index) => {
                    const date = formatDate(diagnostic.submittedAt);
                    return (
                        <li
                            key={diagnostic.id}
                            className="flex flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center"
                        >
                            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="font-semibold text-ink">
                                        Diagnostic du {date}
                                    </h2>
                                    {index === 0 && (
                                        <Badge variant="success">
                                            Le plus récent
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-ink-muted">
                                    Score global :{" "}
                                    <strong className="text-ink">
                                        {diagnostic.global === null
                                            ? "non calculé"
                                            : `${roundScore(diagnostic.global)} / 100`}
                                    </strong>
                                    {diagnostic.maturity &&
                                        ` · ${diagnostic.maturity}`}
                                </p>
                                <ul
                                    aria-label={`Scores par domaine du ${date}`}
                                    className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted"
                                >
                                    {DOMAIN_KEYS.filter(
                                        (domain) =>
                                            diagnostic.pillars[domain] !==
                                            undefined,
                                    ).map((domain) => {
                                        const value =
                                            diagnostic.pillars[domain];
                                        return (
                                            <li key={domain}>
                                                {DOMAINS[domain].label} :{" "}
                                                {value === null ||
                                                value === undefined
                                                    ? "non concerné"
                                                    : roundScore(value)}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                                <Button asChild variant="outline" size="row">
                                    <a
                                        href={`/diagnostic-files/${diagnostic.id}`}
                                        aria-label={`Télécharger la synthèse du ${date} (PDF)`}
                                    >
                                        <Download aria-hidden="true" />
                                        Synthèse PDF
                                    </a>
                                </Button>
                                <Button asChild variant="outline" size="row">
                                    <Link
                                        href={`/diagnostic/historique/${diagnostic.id}`}
                                        aria-label={`Voir le résultat du ${date}`}
                                    >
                                        Voir le résultat
                                        <ArrowRight aria-hidden="true" />
                                    </Link>
                                </Button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
}
