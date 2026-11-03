"use client";

import {
    useActionState,
    useRef,
    useState,
    useSyncExternalStore,
    type FormEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import {
    CircleAlert,
    CircleCheck,
    Eye,
    EyeOff,
    LoaderCircle,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { login, type LoginField, type LoginState } from "@/lib/auth/actions";
import {
    clearActivatedEmail,
    readActivatedEmail,
} from "@/lib/auth/activated-email";

export type LoginFormProps = {
    /** Page to open after login (validated again by the server action). */
    next?: string;
    /** Injected in tests; the server action by default. */
    action?: typeof login;
    /** Opened right after an account activation: notice and its e-mail. */
    activated?: boolean;
};

/** Shown after the activation page redirects here (`?activated=1`). */
export const ACTIVATED_NOTICE =
    "Votre compte est activé. Connectez-vous avec votre nouveau mot de passe.";

/** Remembered e-mail, kept on this device only when the user asks for it. */
export const REMEMBERED_EMAIL_KEY = "reglo.rememberedEmail";

function readRememberedEmail(): string | null {
    try {
        return window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
    } catch {
        // Storage can be blocked (private mode, site data disabled).
        return null;
    }
}

function writeRememberedEmail(email: string | null) {
    try {
        if (email) {
            window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        } else {
            window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        }
    } catch {
        // Not critical: the user just types the e-mail next time.
    }
}

// Only read once on load: the value is written on submit, right before
// leaving the page, so there is nothing to subscribe to.
const noSubscription = () => () => {};

export function LoginForm({
    next,
    action = login,
    activated = false,
}: LoginFormProps) {
    const [state, formAction, isPending] = useActionState<LoginState, FormData>(
        action,
        {},
    );
    const [showPassword, setShowPassword] = useState(false);
    // Fields typed in since the last answer: a new answer starts empty.
    const [edits, setEdits] = useState<{
        state: LoginState;
        fields: LoginField[];
    }>({ state, fields: [] });
    const editedFields = edits.state === state ? edits.fields : [];
    const invalidFields = state.invalidFields ?? [];
    // A field stays in error until the user types in it; the message goes
    // once every field in error has been typed in. A message with no field
    // in error (throttled, API down) stays until the next submit.
    const isInvalid = (field: LoginField) =>
        invalidFields.includes(field) && !editedFields.includes(field);
    const showError =
        Boolean(state.error) &&
        (invalidFields.length === 0 || invalidFields.some(isInvalid));
    // Right after an activation, the new account's e-mail, never the one
    // remembered for another account.
    const prefilledEmail = useSyncExternalStore(
        noSubscription,
        activated ? readActivatedEmail : readRememberedEmail,
        () => null,
    );
    const isRemembered = !activated && prefilledEmail !== null;
    const rememberRef = useRef<HTMLInputElement>(null);

    function markEdited(field: LoginField) {
        if (!editedFields.includes(field)) {
            setEdits({ state, fields: [...editedFields, field] });
        }
    }

    /** Error props of a field: red border and link to the message. */
    function errorProps(field: LoginField) {
        const invalid = showError && isInvalid(field);
        return {
            "aria-invalid": invalid || undefined,
            "aria-describedby": invalid ? "login-error" : undefined,
            onChange: () => markEdited(field),
        };
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        const email = new FormData(event.currentTarget).get("email");
        clearActivatedEmail();
        writeRememberedEmail(
            rememberRef.current?.checked && typeof email === "string"
                ? email.trim()
                : null,
        );
    }

    return (
        <form
            action={formAction}
            onSubmit={handleSubmit}
            className="flex flex-col gap-5"
            noValidate
        >
            {activated && !state.error && (
                <Alert variant="success">
                    <CircleCheck aria-hidden="true" />
                    <AlertDescription>{ACTIVATED_NOTICE}</AlertDescription>
                </Alert>
            )}

            {showError && (
                <Alert variant="destructive" id="login-error">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            )}

            {next && <input type="hidden" name="next" value={next} />}

            <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-base font-medium">
                    Adresse e-mail
                </label>
                <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    placeholder="vous@entreprise.fr"
                    required
                    defaultValue={state.email ?? prefilledEmail ?? undefined}
                    // Resets the field to the returned value after a failure,
                    // or to the stored e-mail once storage is read.
                    key={state.email ?? prefilledEmail ?? ""}
                    {...errorProps("email")}
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-base font-medium">
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
                        {...errorProps("password")}
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

            <div className="flex items-center justify-between gap-4 text-sm">
                <label className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                        ref={rememberRef}
                        defaultChecked={isRemembered}
                        key={String(isRemembered)}
                    />
                    Se souvenir de moi
                </label>
                {/* TODO: password reset page (not in scope of US-02 yet). */}
                <a
                    href="#"
                    onClick={(event) => event.preventDefault()}
                    className="link-underline font-medium text-green-700"
                >
                    Mot de passe oublié ?
                </a>
            </div>

            <Button
                type="submit"
                size="lg"
                disabled={isPending}
                // Same hover transition as the dashboard action (`transition`
                // also animates the brightness).
                className="text-base transition duration-200"
            >
                {isPending && (
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                )}
                {isPending ? "Connexion…" : "Se connecter"}
            </Button>
        </form>
    );
}

/**
 * Reads ?next= set by the proxy when a private page was requested, and
 * ?activated=1 set by the activation page.
 */
export function LoginFormWithRedirect() {
    const searchParams = useSearchParams();
    const next = searchParams.get("next") ?? undefined;
    const activated = searchParams.get("activated") === "1";
    return <LoginForm next={next} activated={activated} />;
}
