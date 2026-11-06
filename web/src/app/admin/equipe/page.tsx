import { Suspense } from "react";
import type { Metadata } from "next";
import { UserPlus } from "lucide-react";

import { AccountDialog } from "@/components/admin/admin-form";
import { AccountTable } from "@/components/admin/account-table";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { orNotFoundWhenRefused } from "@/lib/admin/access";
import { inviteTeamMember } from "@/lib/admin/actions";
import { api } from "@/lib/api";

export const metadata: Metadata = { title: "Équipe Réglo" };

async function TeamContent() {
    const [team, user] = await Promise.all([
        orNotFoundWhenRefused(api.getAdminTeam()),
        api.getCurrentUser(),
    ]);

    return (
        <Card className="gap-0 pb-0">
            <AccountTable
                title="Membres"
                accounts={team}
                team
                currentUserId={user.id}
                action={
                    <AccountDialog
                        title="Inviter un membre"
                        description="La personne reçoit un e-mail pour choisir son mot de passe, et accède au back office. Le lien est valable 48 heures."
                        submitLabel="Envoyer l'invitation"
                        action={inviteTeamMember}
                        icon={<UserPlus aria-hidden="true" />}
                    />
                }
            />
        </Card>
    );
}

export default function AdminTeamPage() {
    return (
        <>
            <PageHeader
                title="Équipe Réglo"
                description="Les personnes qui ont accès au back office."
            />
            <Suspense
                fallback={
                    <div aria-busy="true">
                        <span className="sr-only">Chargement…</span>
                        <Skeleton className="h-72 rounded-lg" />
                    </div>
                }
            >
                <TeamContent />
            </Suspense>
        </>
    );
}
