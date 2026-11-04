import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { ActionList, NoAction } from "@/components/action-plan/action-list";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, canEdit } from "@/lib/api";

export const metadata: Metadata = { title: "Plan d'actions" };

/** Action plan of the organization (US-09). */
async function ActionsContent() {
    const [user, actions] = await Promise.all([
        api.getCurrentUser(),
        api.getActions(),
    ]);
    const editable = canEdit(user.role);

    return (
        <>
            <PageHeader
                title="Plan d'actions"
                description={
                    editable
                        ? "Les actions qui améliorent votre score QHSE : qui fait quoi, et pour quand."
                        : "Les actions qui améliorent votre score QHSE. En lecture seule, vous les consultez sans les modifier."
                }
                action={
                    editable &&
                    actions.length > 0 && (
                        <Button asChild>
                            <Link href="/actions/nouvelle">
                                <Plus aria-hidden="true" />
                                Nouvelle action
                            </Link>
                        </Button>
                    )
                }
            />
            {actions.length === 0 ? (
                <NoAction canEdit={editable} />
            ) : (
                <ActionList actions={actions} />
            )}
        </>
    );
}

function ActionsSkeleton() {
    return (
        <div className="flex flex-col gap-6" aria-busy="true">
            <span className="sr-only">Chargement…</span>
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-80 rounded-lg" />
        </div>
    );
}

export default function ActionsPage() {
    return (
        <Suspense fallback={<ActionsSkeleton />}>
            <ActionsContent />
        </Suspense>
    );
}
