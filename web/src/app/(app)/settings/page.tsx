import { Suspense } from "react";
import type { Metadata } from "next";
import { Building2, KeyRound, Mail, UserRound } from "lucide-react";

import { AvatarForm } from "@/components/profile/avatar-form";
import { EmailForm } from "@/components/profile/email-form";
import { PasswordForm } from "@/components/profile/password-form";
import { ProfileForm } from "@/components/profile/profile-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, PLATFORM_ROLE_LABEL, ROLE_LABELS } from "@/lib/api";
import { cn } from "@/lib/utils";

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

const TAB_TRIGGER = "max-sm:px-2 max-sm:text-sm max-sm:[&_svg]:hidden";

/** The content of the chosen tab fades in, slightly rising. */
const TAB_PANEL =
    "duration-300 animate-in fade-in-0 slide-in-from-bottom-1 motion-reduce:animate-none";

/** "Mon profil": every user changes their own account here. */
async function SettingsContent() {
    const user = await api.getCurrentUser();
    const fullName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
    const organization = user.organization;
    const roleLabel = user.platformAdmin
        ? PLATFORM_ROLE_LABEL
        : ROLE_LABELS[user.role];

    return (
        <div className="flex flex-col gap-6">
            <div className="overflow-hidden rounded-lg border border-border bg-white">
                <div
                    aria-hidden="true"
                    className="h-28 bg-profile-banner sm:h-40"
                />
                <div className="px-5 pb-6 sm:px-8">
                    <AvatarForm user={user} fullName={fullName}>
                        <div className="flex min-w-0 flex-1 flex-col gap-5 sm:pt-6 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex min-w-0 flex-col gap-1">
                                <h1 className="font-display text-xl font-extrabold tracking-wide wrap-break-word text-ink uppercase sm:text-2xl">
                                    {fullName}
                                </h1>
                                {user.jobTitle && (
                                    <p className="font-medium">
                                        {user.jobTitle}
                                    </p>
                                )}
                                <p className="wrap-break-word text-ink-muted">
                                    {user.email}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span
                                    aria-hidden="true"
                                    className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand-teal"
                                >
                                    <Building2 className="size-6" />
                                </span>
                                <div className="flex min-w-0 flex-col items-start gap-1">
                                    {organization && (
                                        <p className="text-lg leading-tight font-semibold wrap-break-word">
                                            <span className="sr-only">
                                                Organisation :{" "}
                                            </span>
                                            {organization.name}
                                        </p>
                                    )}
                                    <Badge variant="secondary">
                                        <span className="sr-only">Rôle : </span>
                                        {roleLabel}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </AvatarForm>
                </div>
            </div>

            <Card className="gap-0 py-0">
                <Tabs defaultValue="profile" className="gap-0">
                    <div className="px-5 pt-5 sm:px-8 sm:pt-6">
                        <TabsList
                            variant="segmented"
                            aria-label="Paramètres du compte"
                        >
                            <TabsTrigger
                                value="profile"
                                className={TAB_TRIGGER}
                            >
                                <UserRound aria-hidden="true" />
                                Profil
                            </TabsTrigger>
                            <TabsTrigger value="email" className={TAB_TRIGGER}>
                                <Mail aria-hidden="true" />
                                Adresse e-mail
                            </TabsTrigger>
                            <TabsTrigger
                                value="password"
                                className={TAB_TRIGGER}
                            >
                                <KeyRound aria-hidden="true" />
                                Mot de passe
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent
                        value="profile"
                        className={cn(TAB_PANEL, "divide-y divide-border")}
                    >
                        <SettingsSection
                            title="Informations personnelles"
                            description="Visibles par les membres de votre organisation."
                        >
                            <ProfileForm user={user} />
                        </SettingsSection>
                        {!user.platformAdmin && (
                            <SettingsSection
                                title="Organisation"
                                description="Seul un administrateur peut modifier les rôles."
                            >
                                <dl className="grid gap-5 text-base sm:grid-cols-2">
                                    <div className="flex flex-col gap-1">
                                        <dt className="font-medium">
                                            Entreprise
                                        </dt>
                                        <dd className="text-ink-muted">
                                            {user.organization?.name ?? "—"}
                                        </dd>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <dt className="font-medium">
                                            Votre rôle
                                        </dt>
                                        <dd className="text-ink-muted">
                                            {ROLE_LABELS[user.role]}.{" "}
                                            {ROLE_DESCRIPTIONS[user.role]}
                                        </dd>
                                    </div>
                                </dl>
                            </SettingsSection>
                        )}
                    </TabsContent>

                    <TabsContent value="email" className={TAB_PANEL}>
                        <SettingsSection
                            title="Adresse e-mail"
                            description="Celle avec laquelle vous vous connectez et recevez nos e-mails. La nouvelle adresse est confirmée par un lien."
                        >
                            <EmailForm currentEmail={user.email} />
                        </SettingsSection>
                    </TabsContent>

                    <TabsContent value="password" className={TAB_PANEL}>
                        <SettingsSection
                            title="Mot de passe"
                            description="Vos autres sessions seront déconnectées."
                        >
                            <PasswordForm email={user.email} />
                        </SettingsSection>
                    </TabsContent>
                </Tabs>
            </Card>
        </div>
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
