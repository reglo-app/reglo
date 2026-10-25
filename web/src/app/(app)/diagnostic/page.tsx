import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Diagnostic" };

export default function Page() {
    return (
        <ComingSoon
            title="Diagnostic"
            description="Évaluez votre entreprise sur les quatre domaines QHSE."
        />
    );
}
