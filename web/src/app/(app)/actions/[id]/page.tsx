import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Pencil } from "lucide-react";

import { DeleteActionButton } from "@/components/action-plan/action-controls";
import { ActionDetailView } from "@/components/action-plan/action-detail";
import { ActionDetailSkeleton } from "@/components/action-plan/skeletons";
import { LinkedDocuments } from "@/components/documents/linked-documents";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { canChangeStatus, todayInFrance } from "@/lib/action-plan/labels";
import { api, canEdit } from "@/lib/api";
import {
    linkActionDocument,
    unlinkActionDocument,
} from "@/lib/documents/actions";

type Params = PageProps<"/actions/[id]">["params"];

export async function generateMetadata({
    params,
}: PageProps<"/actions/[id]">): Promise<Metadata> {
    const { id } = await params;
    const action = await api.getAction(id);
    return { title: action?.title ?? "Action" };
}

async function ActionContent({ params }: { params: Params }) {
    const { id } = await params;
    const [user, action, documents] = await Promise.all([
        api.getCurrentUser(),
        api.getAction(id),
        api.getDocuments(),
    ]);
    if (!action) {
        notFound();
    }
    // Today's date: rendered for each request.
    await connection();

    return (
        <>
            <PageHeader
                title={action.title}
                action={
                    canEdit(user.role) && (
                        <div className="flex flex-wrap gap-3">
                            <Button asChild variant="outline">
                                <Link href={`/actions/${action.id}/modifier`}>
                                    <Pencil aria-hidden="true" />
                                    Modifier
                                </Link>
                            </Button>
                            <DeleteActionButton
                                actionId={action.id}
                                title={action.title}
                            />
                        </div>
                    )
                }
            />
            <ActionDetailView
                action={action}
                canChangeStatus={canChangeStatus(action, user)}
                today={todayInFrance()}
                evidence={
                    <Card>
                        <CardContent className="flex flex-col gap-4">
                            <h2 className="text-lg font-semibold">
                                Justificatifs
                            </h2>
                            <LinkedDocuments
                                documents={action.documents}
                                available={documents}
                                subject="cette action"
                                canEdit={canEdit(user.role)}
                                link={linkActionDocument.bind(null, action.id)}
                                unlink={unlinkActionDocument.bind(
                                    null,
                                    action.id,
                                )}
                            />
                        </CardContent>
                    </Card>
                }
            />
        </>
    );
}

/** One action of the action plan (US-09). */
export default function ActionPage({ params }: PageProps<"/actions/[id]">) {
    // Reading the URL params inside Suspense keeps navigation instant.
    return (
        <Suspense fallback={<ActionDetailSkeleton />}>
            <ActionContent params={params} />
        </Suspense>
    );
}
