import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ActionForm } from "@/components/action-plan/action-form";
import { ActionFormSkeleton } from "@/components/action-plan/skeletons";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { todayInFrance } from "@/lib/action-plan/labels";
import { api, canEdit } from "@/lib/api";

export const metadata: Metadata = { title: "Modifier l'action" };

type Params = PageProps<"/actions/[id]/modifier">["params"];

async function EditActionContent({ params }: { params: Params }) {
    const { id } = await params;
    const [user, action, members] = await Promise.all([
        api.getCurrentUser(),
        api.getAction(id),
        api.getMembers(),
    ]);
    if (!action) {
        notFound();
    }
    if (!canEdit(user.role)) redirect(`/actions/${action.id}`);

    return (
        <ActionForm action={action} members={members} today={todayInFrance()} />
    );
}

/** Change of an action (US-09): administrators and members. */
export default function EditActionPage({
    params,
}: PageProps<"/actions/[id]/modifier">) {
    return (
        <>
            <PageHeader
                title="Modifier l'action"
                description="Un nouveau responsable reçoit un e-mail."
            />
            <Card className="max-w-3xl">
                <CardContent>
                    <Suspense fallback={<ActionFormSkeleton />}>
                        <EditActionContent params={params} />
                    </Suspense>
                </CardContent>
            </Card>
        </>
    );
}
