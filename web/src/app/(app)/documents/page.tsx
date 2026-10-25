import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Justificatifs" };

export default function Page() {
    return (
        <ComingSoon
            title="Justificatifs"
            description="Centralisez les preuves de votre conformité."
        />
    );
}
