import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Plan d'actions" };

export default function Page() {
    return (
        <ComingSoon
            title="Plan d'actions"
            description="Suivez les actions qui améliorent votre score."
        />
    );
}
