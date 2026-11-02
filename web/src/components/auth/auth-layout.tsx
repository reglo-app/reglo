import type { ReactNode } from "react";
import Image from "next/image";
import { cacheLife } from "next/cache";

import { BrandCarousel } from "@/components/auth/brand-carousel";

/** Cached: reading the clock is not allowed in a prerendered page. */
async function copyrightYear() {
    "use cache";
    cacheLife("days");
    return new Date().getFullYear();
}

/**
 * Layout of the signed-out pages (login, account activation): brand panel
 * on the left on desktop, form panel on the right.
 */
export async function AuthLayout({ children }: { children: ReactNode }) {
    const year = await copyrightYear();

    return (
        <main className="grid min-h-full flex-1 bg-auth-panel lg:grid-cols-2">
            {/* Brand panel, desktop only. The right padding keeps the content
                centred in the part the form panel does not cover. */}
            <div className="hidden items-center justify-center p-12 pr-[calc(3rem+2.5rem)] lg:flex">
                <BrandCarousel />
            </div>

            {/* Form panel: on desktop it slides over the brand panel like a
                drawer (negative margin, rounded left edge, shadow). */}
            <div className="relative z-10 flex flex-col bg-white px-4 py-6 sm:px-8 lg:-ml-10 lg:rounded-l-[2.5rem] lg:px-12 lg:shadow-(--shadow-drawer)">
                {/* Single column only. Under 750px: the symbol alone, centred;
                    from 750px: symbol and wordmark on the left. The image
                    carries the name, so the wordmark is hidden from screen
                    readers to avoid reading it twice. */}
                <div className="flex items-center justify-center gap-3 min-[750px]:justify-start lg:hidden">
                    <Image
                        src="/brand/reglo-symbol.png"
                        alt="REGLO"
                        width={36}
                        height={28}
                        priority
                    />
                    <span
                        aria-hidden="true"
                        className="hidden font-display text-2xl font-extrabold text-brand-teal min-[750px]:inline"
                    >
                        REGLO
                    </span>
                </div>

                <div className="flex flex-1 items-center justify-center py-12">
                    <div className="w-full max-w-sm">{children}</div>
                </div>

                {/* Same padding on both texts, so the separator sits in the
                    middle. */}
                <footer className="flex items-center justify-center gap-px text-sm text-ink-muted">
                    <span className="px-1">© {year} REGLO</span>
                    <span aria-hidden="true">-</span>
                    <a
                        href="mailto:contact@reglo.site"
                        className="rounded-md px-1 py-1 transition-all duration-200 hover:text-brand-teal"
                    >
                        Contact
                    </a>
                </footer>
            </div>
        </main>
    );
}

/** Title and short text above the form of a signed-out page. */
export function AuthHeading({
    title,
    children,
}: {
    title: string;
    children?: ReactNode;
}) {
    return (
        <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold">{title}</h1>
            {children && <p className="mt-2 text-ink-muted">{children}</p>}
        </div>
    );
}
