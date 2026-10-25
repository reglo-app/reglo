import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { cacheLife } from "next/cache";

import { BrandCarousel } from "@/components/auth/brand-carousel";
import { LoginForm, LoginFormWithRedirect } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Connexion" };

/** Cached: reading the clock is not allowed in a prerendered page. */
async function copyrightYear() {
    "use cache";
    cacheLife("days");
    return new Date().getFullYear();
}

export default async function LoginPage() {
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
                    <div className="w-full max-w-sm">
                        <div className="mb-8 text-center">
                            <h1 className="text-2xl font-semibold">
                                Ravi de vous revoir !
                            </h1>
                            <p className="mt-2 text-ink-muted">
                                Connectez-vous pour retrouver votre espace
                                Réglo.
                            </p>
                        </div>

                        {/* useSearchParams needs a boundary; the fallback is
                            the same form, so nothing moves. */}
                        <Suspense fallback={<LoginForm />}>
                            <LoginFormWithRedirect />
                        </Suspense>
                    </div>
                </div>

                {/* Same padding on both texts, so the separator sits in the
                    middle. */}
                <footer className="flex items-center justify-center gap-1 text-sm text-ink-muted">
                    <span className="px-1">© {year} REGLO</span>
                    <span aria-hidden="true">-</span>
                    <a
                        href="mailto:contact@reglo.site"
                        className="rounded-md px-1 py-1 transition-colors duration-200 hover:bg-green-50 hover:text-ink"
                    >
                        Contact
                    </a>
                </footer>
            </div>
        </main>
    );
}
