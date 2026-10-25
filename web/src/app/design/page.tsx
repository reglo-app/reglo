import type { Metadata } from "next";

import { Showcase } from "./showcase";

export const metadata: Metadata = {
    title: "Design system",
    robots: { index: false },
};

/** Internal page listing the base components, for the review with the DAs. */
export default function DesignPage() {
    return (
        <main className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-8">
            <h1 className="font-display text-xl font-extrabold tracking-wide uppercase sm:text-2xl">
                Design system
            </h1>
            <p className="mt-2 mb-10 text-ink-muted">
                Composants de base de REGLO, stylés avec les tokens de la
                charte.
            </p>
            <Showcase />
        </main>
    );
}
