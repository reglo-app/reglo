import type { Metadata } from "next";

import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Veille réglementaire" };

export default function Page() {
    return (
        <ComingSoon
            title="Veille réglementaire"
            description="Restez informé des évolutions qui vous concernent."
        />
    );
}
