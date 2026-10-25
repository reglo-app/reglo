import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Paramètres" };

export default function Page() {
    return (
        <ComingSoon
            title="Paramètres"
            description="Gérez votre organisation, vos utilisateurs et votre profil."
        />
    );
}
