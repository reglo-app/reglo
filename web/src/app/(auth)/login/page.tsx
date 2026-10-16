import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";

import { LoginForm, LoginFormWithRedirect } from "@/components/auth/login-form";
import { DOMAIN_KEYS, DOMAINS } from "@/lib/domains";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
    return (
        <main className="grid min-h-full flex-1 lg:grid-cols-2">
            {/* Brand panel, desktop only: decorative, the form is enough. */}
            <section
                aria-hidden="true"
                className="hidden flex-col justify-between bg-brand-gradient p-12 text-white lg:flex"
            >
                <div className="flex items-center gap-3">
                    <Image
                        src="/brand/reglo-symbol.png"
                        alt=""
                        width={36}
                        height={28}
                        priority
                    />
                    <span className="font-display text-2xl font-extrabold">
                        REGLO
                    </span>
                </div>
                <div className="flex flex-col gap-6">
                    <p className="font-display max-w-md text-3xl font-extrabold tracking-wide uppercase">
                        Humain en mouvement vers l&apos;avenir
                    </p>
                    <p className="max-w-md text-lg">
                        Pilotez votre démarche QHSE au même endroit :
                        diagnostic, plan d&apos;actions, justificatifs et
                        formations.
                    </p>
                    <ul className="flex flex-wrap gap-2">
                        {DOMAIN_KEYS.map((key) => (
                            <li
                                key={key}
                                className="rounded-sm border border-white/40 px-3 py-1 text-sm font-medium"
                            >
                                {DOMAINS[key].label}
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <div className="flex items-center justify-center px-4 py-12 sm:px-8">
                <div className="w-full max-w-sm">
                    <div className="mb-8 flex items-center gap-3 lg:hidden">
                        <Image
                            src="/brand/reglo-symbol.png"
                            alt=""
                            width={36}
                            height={28}
                            priority
                        />
                        <span className="font-display text-2xl font-extrabold text-brand-teal">
                            REGLO
                        </span>
                    </div>

                    <h1 className="text-2xl font-semibold">Connexion</h1>
                    <p className="mt-1 mb-8 text-ink-muted">
                        Accédez à l&apos;espace de votre organisation.
                    </p>

                    <div className="rounded-lg border border-border bg-white p-6">
                        {/* useSearchParams needs a boundary; the fallback is
                            the same form, so nothing moves. */}
                        <Suspense fallback={<LoginForm />}>
                            <LoginFormWithRedirect />
                        </Suspense>
                    </div>
                </div>
            </div>
        </main>
    );
}
