import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";

import { DomainBadge } from "@/components/domain-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

type Params = PageProps<"/news/[id]">["params"];

export async function generateMetadata({
    params,
}: PageProps<"/news/[id]">): Promise<Metadata> {
    const { id } = await params;
    const article = await api.getNewsArticle(id);
    return { title: article?.title ?? "Article" };
}

async function Article({ params }: { params: Params }) {
    const { id } = await params;
    const article = await api.getNewsArticle(id);
    if (!article) {
        notFound();
    }

    return (
        <article className="flex max-w-3xl flex-col gap-6">
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
                    <DomainBadge domain={article.domain} />
                    <time dateTime={article.publishedAt}>
                        {formatDate(article.publishedAt)}
                    </time>
                </div>
                <h1 className="font-display text-xl font-extrabold tracking-wide text-ink uppercase sm:text-2xl">
                    {article.title}
                </h1>
                <p className="text-lg text-ink-muted">{article.summary}</p>
            </div>

            {article.imageUrl && (
                <div className="relative aspect-[21/9] overflow-hidden rounded-lg bg-surface-subtle">
                    <Image
                        src={article.imageUrl}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 768px, 100vw"
                        className="object-cover"
                        priority
                    />
                </div>
            )}

            <Card>
                <CardContent className="flex flex-col gap-4 text-base leading-relaxed text-ink">
                    {article.paragraphs.map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                    ))}
                    <p className="text-sm text-ink-muted">
                        Source :{" "}
                        {article.sourceUrl ? (
                            <a
                                href={article.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-green-700 underline"
                            >
                                {article.sourceName}
                            </a>
                        ) : (
                            article.sourceName
                        )}
                    </p>
                </CardContent>
            </Card>

            <div>
                <Button asChild variant="outline">
                    <Link href="/news">
                        <ArrowLeft aria-hidden="true" />
                        Retour à la veille
                    </Link>
                </Button>
            </div>
        </article>
    );
}

function ArticleSkeleton() {
    return (
        <div className="flex max-w-3xl flex-col gap-4" aria-busy="true">
            <span className="sr-only">Chargement…</span>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="aspect-[21/9] w-full rounded-lg" />
            <Skeleton className="h-48 w-full rounded-lg" />
        </div>
    );
}

/** One regulatory news article. */
export default function NewsArticlePage({ params }: PageProps<"/news/[id]">) {
    // Reading the URL params inside Suspense keeps navigation instant.
    return (
        <Suspense fallback={<ArticleSkeleton />}>
            <Article params={params} />
        </Suspense>
    );
}
