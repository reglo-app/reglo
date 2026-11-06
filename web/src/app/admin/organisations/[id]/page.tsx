import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UserPlus } from "lucide-react";

import { AccountDialog } from "@/components/admin/admin-form";
import { AccountTable } from "@/components/admin/account-table";
import { OrganizationActions } from "@/components/admin/organization-actions";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { orNotFoundWhenRefused } from "@/lib/admin/access";
import { addUser } from "@/lib/admin/actions";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Organisation" };

async function OrganizationContent({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const organization = await orNotFoundWhenRefused(
        api.getAdminOrganization(id),
    );
    if (!organization) notFound();

    return (
        <>
            <PageHeader
                title={organization.name}
                description={`Créée le ${formatDate(organization.createdAt)}.`}
                action={
                    <OrganizationActions
                        id={organization.id}
                        name={organization.name}
                        userCount={organization.users.length}
                    />
                }
            />
            <Card className="gap-0 pb-0">
                <AccountTable
                    title="Comptes"
                    accounts={organization.users}
                    action={
                        <AccountDialog
                            title="Ajouter un compte"
                            description={`La personne reçoit un e-mail pour rejoindre ${organization.name}. Le lien est valable 48 heures.`}
                            submitLabel="Créer le compte"
                            action={addUser}
                            icon={<UserPlus aria-hidden="true" />}
                            organizationId={organization.id}
                            withRole
                        />
                    }
                />
            </Card>
        </>
    );
}

export default function OrganizationPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    return (
        <>
            <Link
                href="/admin"
                className="link-underline mb-4 inline-flex items-center gap-1 text-green-700"
            >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Toutes les organisations
            </Link>
            <Suspense
                fallback={
                    <div className="flex flex-col gap-6" aria-busy="true">
                        <span className="sr-only">Chargement…</span>
                        <Skeleton className="h-10 w-1/3" />
                        <Skeleton className="h-72 rounded-lg" />
                    </div>
                }
            >
                <OrganizationContent params={params} />
            </Suspense>
        </>
    );
}
