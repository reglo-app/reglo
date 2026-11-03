import { Suspense } from "react";
import type { Metadata } from "next";
import { KeyRound, Mail, UserRound } from "lucide-react";

import { AvatarForm } from "@/components/profile/avatar-form";
import { EmailForm } from "@/components/profile/email-form";
import { PasswordForm } from "@/components/profile/password-form";
import { ProfileForm } from "@/components/profile/profile-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ROLE_LABELS } from "@/lib/api";

export const metadata: Metadata = { title: "Paramètres" };

const ROLE_DESCRIPTIONS = {
    admin: "Vous gérez l'organisation, ses membres et toutes ses données.",
    member: "Vous pouvez consulter et modifier les données de l'organisation.",
    reader: "Vous pouvez consulter les données de l'organisation.",
};

/** One block of a tab: title on the left, fields on the right. */
function SettingsSection({
    title,
    description,
    children,
}: {
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <section className="grid gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:gap-12">
            <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="text-ink-muted">{description}</p>
            </div>
            <div className="max-w-3xl min-w-0">{children}</div>
        </section>
    );
}

const TAB_TRIGGER = "max-sm:px-3 max-sm:[&_svg]:hidden";

/** "Mon profil": every user changes their own account here. */
async function SettingsContent() {
    const user = await api.getCurrentUser();
    const fullName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    const subtitle = [user.jobTitle, user.organization?.name]
        .filter(Boolean)
        .join(" · ");

    return (
        <Tabs defaultValue="profile">
            <div className="overflow-hidden rounded-lg border border-border bg-white">
                <div
                    aria-hidden="true"
                    className="h-28 bg-profile-banner sm:h-40"
                />
                <div className="px-5 pb-5 sm:px-8">
                    <AvatarForm user={user} fullName={fullName}>
                        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:pb-1">
                            <div className="flex min-w-0 flex-col gap-1">
                                <h1 className="font-display text-xl font-extrabold tracking-wide wrap-break-word text-ink uppercase sm:text-2xl">
                                    {fullName}
                                </h1>
                                {subtitle && (
                                    <p className="font-medium">{subtitle}</p>
                                )}
                                <p className="wrap-break-word text-ink-muted">
                                    {user.email}
                                </p>
                            </div>
                            <Badge variant="secondary" className="h-7 px-3">
                                {ROLE_LABELS[user.role]}
                            </Badge>
                        </div>
                    </AvatarForm>
                </div>

                <TabsList
                    variant="line"
                    aria-label="Paramètres du compte"
                    className="w-full border-t border-b-0 px-2 sm:px-6"
                >
                    <TabsTrigger value="profile" className={TAB_TRIGGER}>
                        <UserRound aria-hidden="true" />
                        Profil
                    </TabsTrigger>
                    <TabsTrigger value="email" className={TAB_TRIGGER}>
                        <Mail aria-hidden="true" />
                        Adresse e-mail
                    </TabsTrigger>
                    <TabsTrigger value="password" className={TAB_TRIGGER}>
                        <KeyRound aria-hidden="true" />
                        Mot de passe
                    </TabsTrigger>
                </TabsList>
            </div>

            <TabsContent value="profile">
                <Card className="gap-0 divide-y divide-border py-0">
                    <SettingsSection
                        title="Informations personnelles"
                        description="Visibles par les membres de votre organisation."
                    >
                        <ProfileForm user={user} />
                    </SettingsSection>
                    <SettingsSection
                        title="Organisation"
                        description="Seul un administrateur peut modifier les rôles."
                    >
                        <dl className="grid gap-5 text-base sm:grid-cols-2">
                            <div className="flex flex-col gap-1">
                                <dt className="font-medium">Entreprise</dt>
                                <dd className="text-ink-muted">
                                    {user.organization?.name ?? "—"}
                                </dd>
                            </div>
                            <div className="flex flex-col gap-1">
                                <dt className="font-medium">Votre rôle</dt>
                                <dd className="text-ink-muted">
                                    {ROLE_LABELS[user.role]}.{" "}
                                    {ROLE_DESCRIPTIONS[user.role]}
                                </dd>
                            </div>
                        </dl>
                    </SettingsSection>
                </Card>
            </TabsContent>

            <TabsContent value="email">
                <Card className="gap-0 py-0">
                    <SettingsSection
                        title="Adresse e-mail"
                        description="Celle avec laquelle vous vous connectez et recevez nos e-mails. La nouvelle adresse est confirmée par un lien."
                    >
                        <EmailForm currentEmail={user.email} />
                    </SettingsSection>
                </Card>
            </TabsContent>

            <TabsContent value="password">
                <Card className="gap-0 py-0">
                    <SettingsSection
                        title="Mot de passe"
                        description="Vos autres sessions seront déconnectées."
                    >
                        <PasswordForm email={user.email} />
                    </SettingsSection>
                </Card>
            </TabsContent>
        </Tabs>
    );
}

function SettingsSkeleton() {
    return (
        <div className="flex flex-col gap-6" aria-busy="true">
            <span className="sr-only">Chargement…</span>
            <Skeleton className="h-80 rounded-lg" />
            <Skeleton className="h-96 rounded-lg" />
        </div>
    );
}

export default function SettingsPage() {
    return (
        <Suspense fallback={<SettingsSkeleton />}>
            <SettingsContent />
        </Suspense>
    );
}
