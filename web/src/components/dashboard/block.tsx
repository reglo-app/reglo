import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

/** Title row of a home page block: icon, title, extra, "Tout voir". */
export function BlockHeader({
    icon: Icon,
    title,
    extra,
    seeAll,
}: {
    icon: LucideIcon;
    title: string;
    extra?: React.ReactNode;
    seeAll?: { href: string; label: string };
}) {
    return (
        <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Icon aria-hidden="true" className="size-5 text-green-700" />
                <h2 className="whitespace-nowrap">{title}</h2>
                {extra}
            </CardTitle>
            {seeAll && (
                <CardAction>
                    <Button asChild variant="seeAll" size="seeAll">
                        <Link href={seeAll.href}>
                            Tout voir
                            <span className="sr-only"> : {seeAll.label}</span>
                            <ChevronRight aria-hidden="true" />
                        </Link>
                    </Button>
                </CardAction>
            )}
        </CardHeader>
    );
}

export function EmptyLine({ children }: { children: React.ReactNode }) {
    return <p className="py-3 text-sm text-ink-muted">{children}</p>;
}

/**
 * A block whose data does not exist yet: says so instead of showing
 * fictitious data to clients.
 */
export function ComingSoonCard({
    icon,
    title,
    children,
}: {
    icon: LucideIcon;
    title: string;
    /** What the block will show. */
    children: React.ReactNode;
}) {
    return (
        <Card>
            <BlockHeader icon={icon} title={title} />
            <CardContent className="flex flex-col gap-1 py-3">
                <p className="font-semibold">Bientôt disponible</p>
                <p className="text-sm text-ink-muted">{children}</p>
            </CardContent>
        </Card>
    );
}
