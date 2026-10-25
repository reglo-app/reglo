import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Formations" };

export default function Page() {
    return (
        <ComingSoon
            title="Formations"
            description="Gérez les formations et habilitations de vos équipes."
        />
    );
}
