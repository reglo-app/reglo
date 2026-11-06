import { Suspense } from "react";
import type { Metadata } from "next";
import { Building2 } from "lucide-react";

import { AccountDialog } from "@/components/admin/admin-form";
import { OrganizationTable } from "@/components/admin/organization-table";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { orNotFoundWhenRefused } from "@/lib/admin/access";
import { createOrganization } from "@/lib/admin/actions";
import { api } from "@/lib/api";

export const metadata: Metadata = { title: "Organisations" };

async function OrganizationsContent() {
    const organizations = await orNotFoundWhenRefused(
        api.getAdminOrganizations(),
    );

    return (
        <Card className="gap-0 pb-0">
            <OrganizationTable
                organizations={organizations}
                action={
                    <AccountDialog
                        title="Créer une organisation"
                        description="Son premier administrateur reçoit un e-mail pour choisir son mot de passe. Le lien est valable 48 heures."
                        submitLabel="Créer l'organisation"
                        action={createOrganization}
                        icon={<Building2 aria-hidden="true" />}
                        withOrganizationName
                    />
                }
            />
        </Card>
    );
}

export default function OrganizationsPage() {
    return (
        <>
            <PageHeader
                title="Organisations"
                description="Les clients de Réglo et leurs accès. Le back office ne donne pas accès à leurs données."
            />
            <Suspense
                fallback={
                    <div aria-busy="true">
                        <span className="sr-only">Chargement…</span>
                        <Skeleton className="h-72 rounded-lg" />
                    </div>
                }
            >
                <OrganizationsContent />
            </Suspense>
        </>
    );
}
