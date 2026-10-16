"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login, type LoginState } from "@/lib/auth/actions";

export type LoginFormProps = {
    /** Page to open after login (validated again by the server action). */
    next?: string;
    /** Injected in tests; the server action by default. */
    action?: typeof login;
};

export function LoginForm({ next, action = login }: LoginFormProps) {
    const [state, formAction, isPending] = useActionState<LoginState, FormData>(
        action,
        {},
    );
    const [showPassword, setShowPassword] = useState(false);
    const hasError = Boolean(state.error);

    return (
        <form action={formAction} className="flex flex-col gap-5" noValidate>
            {state.error && (
                <Alert variant="destructive" id="login-error">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            )}

            {next && <input type="hidden" name="next" value={next} />}

            <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium">
                    Adresse e-mail
                </label>
                <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    required
                    defaultValue={state.email}
                    // Resets the field to the returned value after a failure.
                    key={state.email}
                    aria-invalid={hasError || undefined}
                    aria-describedby={hasError ? "login-error" : undefined}
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm font-medium">
                    Mot de passe
                </label>
                <div className="relative">
                    <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        className="pr-11"
                        aria-invalid={hasError || undefined}
                        aria-describedby={hasError ? "login-error" : undefined}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword((shown) => !shown)}
                        aria-label="Afficher le mot de passe"
                        aria-pressed={showPassword}
                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-ink-muted transition-colors hover:text-ink"
                    >
                        {showPassword ? (
                            <EyeOff aria-hidden="true" className="size-5" />
                        ) : (
                            <Eye aria-hidden="true" className="size-5" />
                        )}
                    </button>
                </div>
            </div>

            <Button type="submit" size="lg" disabled={isPending}>
                {isPending && (
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                )}
                {isPending ? "Connexion…" : "Se connecter"}
            </Button>
        </form>
    );
}

/** Reads ?next= set by the proxy when a private page was requested. */
export function LoginFormWithRedirect() {
    const next = useSearchParams().get("next") ?? undefined;
    return <LoginForm next={next} />;
}
