import { Construction } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

/** Placeholder for sections that are not built yet. */
export function ComingSoon({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <>
            <PageHeader title={title} description={description} />
            <Card>
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                    <Construction
                        aria-hidden="true"
                        className="size-8 text-green-700"
                    />
                    <p className="text-lg font-semibold">Bientôt disponible</p>
                    <p className="max-w-md text-ink-muted">
                        Cette section est en cours de construction.
                    </p>
                </CardContent>
            </Card>
        </>
    );
}
