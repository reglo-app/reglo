import { Suspense } from "react";
import type { Metadata } from "next";

import { AccountTable } from "@/components/admin/account-table";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { orNotFoundWhenRefused } from "@/lib/admin/access";
import { api } from "@/lib/api";

export const metadata: Metadata = { title: "Utilisateurs" };

async function UsersContent() {
    const users = await orNotFoundWhenRefused(api.getAdminUsers());

    return (
        <Card className="gap-0 pb-0">
            <AccountTable title="Comptes" accounts={users} showOrganization />
        </Card>
    );
}

export default function UsersPage() {
    return (
        <>
            <PageHeader
                title="Utilisateurs"
                description="Tous les comptes des clients. Pour en créer un, ouvrez son organisation."
            />
            <Suspense
                fallback={
                    <div aria-busy="true">
                        <span className="sr-only">Chargement…</span>
                        <Skeleton className="h-72 rounded-lg" />
                    </div>
                }
            >
                <UsersContent />
            </Suspense>
        </>
    );
}
