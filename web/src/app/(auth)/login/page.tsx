import { Suspense } from "react";
import type { Metadata } from "next";

import { AuthHeading, AuthLayout } from "@/components/auth/auth-layout";
import { LoginForm, LoginFormWithRedirect } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
    return (
        <AuthLayout>
            <AuthHeading title="Ravi de vous revoir !">
                Connectez-vous pour retrouver votre espace Réglo.
            </AuthHeading>

            {/* useSearchParams needs a boundary; the fallback is the same
                form, so nothing moves. */}
            <Suspense fallback={<LoginForm />}>
                <LoginFormWithRedirect />
            </Suspense>
        </AuthLayout>
    );
}
