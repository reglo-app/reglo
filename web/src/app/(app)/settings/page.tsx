import { Suspense } from "react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { AvatarForm } from "@/components/profile/avatar-form";
import { EmailForm } from "@/components/profile/email-form";
import { PasswordForm } from "@/components/profile/password-form";
import { ProfileForm } from "@/components/profile/profile-form";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

export const metadata: Metadata = { title: "Paramètres" };

/** "Mon profil": every user changes their own account here. */
async function ProfileContent() {
    const user = await api.getCurrentUser();
    const fullName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

    return (
        <div className="flex max-w-3xl flex-col gap-4">
            <Card>
                <CardHeader>
                    <h2 className="text-lg font-semibold">Mon profil</h2>
                    <CardDescription>
                        Visible par les membres de votre organisation.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                    <AvatarForm user={user} fullName={fullName} />
                    <ProfileForm user={user} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <h2 className="text-lg font-semibold">Adresse e-mail</h2>
                    <CardDescription>
                        Celle avec laquelle vous vous connectez et recevez nos
                        e-mails.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <EmailForm currentEmail={user.email} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <h2 className="text-lg font-semibold">Mot de passe</h2>
                    <CardDescription>
                        Vos autres sessions seront déconnectées.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <PasswordForm email={user.email} />
                </CardContent>
            </Card>
        </div>
    );
}

function ProfileSkeleton() {
    return (
        <div className="flex max-w-3xl flex-col gap-4" aria-busy="true">
            <span className="sr-only">Chargement…</span>
            <Skeleton className="h-96 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
        </div>
    );
}

export default function SettingsPage() {
    return (
        <>
            <PageHeader
                title="Paramètres"
                description="Votre profil et la sécurité de votre compte."
            />
            <Suspense fallback={<ProfileSkeleton />}>
                <ProfileContent />
            </Suspense>
        </>
    );
}
