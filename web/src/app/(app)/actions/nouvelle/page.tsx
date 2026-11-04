import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ActionForm } from "@/components/action-plan/action-form";
import { ActionFormSkeleton } from "@/components/action-plan/skeletons";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { todayInFrance } from "@/lib/action-plan/labels";
import { api, canEdit } from "@/lib/api";
import { DOMAIN_KEYS, type DomainKey } from "@/lib/domains";

export const metadata: Metadata = { title: "Nouvelle action" };

type SearchParams = PageProps<"/actions/nouvelle">["searchParams"];

function single(value: string | string[] | undefined): string {
    return typeof value === "string" ? value : "";
}

/**
 * New action. "?domaine=safety&titre=…" prefills it, e.g. from a priority
 * action of the diagnostic result.
 */
async function NewActionContent({
    searchParams,
}: {
    searchParams: SearchParams;
}) {
    const [user, members, params] = await Promise.all([
        api.getCurrentUser(),
        api.getMembers(),
        searchParams,
    ]);
    if (!canEdit(user.role)) redirect("/actions");

    const domain = single(params.domaine);
    return (
        <ActionForm
            members={members}
            today={todayInFrance()}
            defaults={{
                title: single(params.titre).slice(0, 120),
                domain: DOMAIN_KEYS.includes(domain as DomainKey)
                    ? (domain as DomainKey)
                    : "",
            }}
        />
    );
}

export default function NewActionPage({
    searchParams,
}: PageProps<"/actions/nouvelle">) {
    return (
        <>
            <PageHeader
                title="Nouvelle action"
                description="Le responsable reçoit un e-mail et suit l'action jusqu'à ce qu'elle soit terminée."
            />
            <Card className="max-w-3xl">
                <CardContent>
                    <Suspense fallback={<ActionFormSkeleton />}>
                        <NewActionContent searchParams={searchParams} />
                    </Suspense>
                </CardContent>
            </Card>
        </>
    );
}
