import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { NewsCard } from "@/components/dashboard/dashboard-lists";
import {
    DomainActionsCard,
    DomainScoreCard,
    ExpiringDocumentsCard,
} from "@/components/domain/domain-blocks";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { DOMAIN_KEYS, DOMAINS, isDomainKey } from "@/lib/domains";

type Params = PageProps<"/domains/[domain]">["params"];

export function generateStaticParams() {
    return DOMAIN_KEYS.map((domain) => ({ domain }));
}

export async function generateMetadata({
    params,
}: PageProps<"/domains/[domain]">): Promise<Metadata> {
    const { domain } = await params;
    return isDomainKey(domain) ? { title: DOMAINS[domain].label } : {};
}

/**
 * Same five blocks for the four pillars: score, score per theme, open
 * actions, documents to renew and the pillar's regulatory news.
 */
async function DomainContent({ params }: { params: Params }) {
    const { domain } = await params;
    if (!isDomainKey(domain)) {
        notFound();
    }

    const detail = await api.getDomainDetail(domain);
    const { label } = DOMAINS[domain];

    return (
        <>
            <PageHeader
                title={label}
                description={`Votre situation et vos actions en ${label}.`}
            />
            <div className="flex flex-col gap-4">
                <DomainScoreCard detail={detail} />
                <div className="grid gap-4 lg:grid-cols-2">
                    <DomainActionsCard
                        actions={detail.actions}
                        today={detail.generatedAt}
                    />
                    <ExpiringDocumentsCard
                        documents={detail.expiringDocuments}
                        today={detail.generatedAt}
                    />
                </div>
                <NewsCard news={detail.latestNews} />
            </div>
        </>
    );
}

function DomainSkeleton() {
    return (
        <div className="flex flex-col gap-4" aria-busy="true">
            <span className="sr-only">Chargement…</span>
            <Skeleton className="mb-4 h-14 w-72" />
            <Skeleton className="h-72 rounded-lg" />
            <div className="grid gap-4 lg:grid-cols-2">
                <Skeleton className="h-56 rounded-lg" />
                <Skeleton className="h-56 rounded-lg" />
            </div>
            <Skeleton className="h-72 rounded-lg" />
        </div>
    );
}

/** One page per QHSE pillar. */
export default function DomainPage({ params }: PageProps<"/domains/[domain]">) {
    // Reading the URL params inside Suspense keeps navigation instant.
    return (
        <Suspense fallback={<DomainSkeleton />}>
            <DomainContent params={params} />
        </Suspense>
    );
}
