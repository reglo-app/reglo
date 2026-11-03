import { Suspense } from "react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { InvitationList } from "@/components/team/invitation-list";
import { InviteDialog } from "@/components/team/invite-dialog";
import { MemberTable } from "@/components/team/member-table";
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

export const metadata: Metadata = { title: "Équipe" };

/**
 * "Équipe" (US-03): every member sees the team; administrators also invite
 * collaborators and manage the pending invitations (checked by the API).
 */
async function TeamContent() {
    const user = await api.getCurrentUser();
    const isAdmin = user.role === "admin";
    const organizationName = user.organization?.name ?? "votre organisation";
    const [members, invitations] = await Promise.all([
        api.getMembers(),
        isAdmin ? api.getInvitations() : Promise.resolve([]),
    ]);

    return (
        <>
            <PageHeader
                title="Équipe"
                description={
                    isAdmin
                        ? `Les personnes de ${organizationName} qui utilisent Réglo, leurs rôles et les invitations en attente.`
                        : `Les personnes de ${organizationName} qui utilisent Réglo. Seul un administrateur invite et change les rôles.`
                }
            />

            <div className="flex flex-col gap-6">
                <Card className="gap-0 pb-0">
                    <MemberTable
                        members={members}
                        currentUserId={user.id}
                        canManage={isAdmin}
                        action={
                            isAdmin && (
                                <InviteDialog
                                    organizationName={organizationName}
                                />
                            )
                        }
                    />
                </Card>

                {isAdmin && (
                    <Card className="gap-0 pb-0">
                        <CardHeader className="border-b border-border pb-4">
                            <CardTitle>
                                <h2>
                                    Invitations en attente{" "}
                                    <span className="text-ink/70">
                                        ({invitations.length})
                                    </span>
                                </h2>
                            </CardTitle>
                            <CardDescription>
                                Une invitation expirée peut être renvoyée : un
                                nouveau lien, valable 7 jours, est envoyé.
                            </CardDescription>
                        </CardHeader>
                        <InvitationList invitations={invitations} />
                    </Card>
                )}
            </div>
        </>
    );
}

function TeamSkeleton() {
    return (
        <div className="flex flex-col gap-6" aria-busy="true">
            <span className="sr-only">Chargement…</span>
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-72 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
        </div>
    );
}

export default function TeamPage() {
    return (
        <Suspense fallback={<TeamSkeleton />}>
            <TeamContent />
        </Suspense>
    );
}
