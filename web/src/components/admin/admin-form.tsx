"use client";

import {
    useActionState,
    useCallback,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { FormField } from "@/components/profile/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import type { AdminFormState } from "@/lib/admin/actions";
import {
    ROLE_DESCRIPTIONS,
    ROLE_KEYS,
    ROLE_LABELS,
    type RoleKey,
} from "@/lib/api/types";

type AdminAction = (
    previous: AdminFormState,
    formData: FormData,
) => Promise<AdminFormState>;

export type AccountDialogProps = {
    /** Title of the dialog and text of the button that opens it. */
    title: string;
    description: string;
    submitLabel: string;
    action: AdminAction;
    /** Icon of the button that opens the dialog. */
    icon: ReactNode;
    /** Asks the name of the organization first. */
    withOrganizationName?: boolean;
    /** Asks the role in the organization. */
    withRole?: boolean;
    /** The organization the account goes to. */
    organizationId?: string;
};

/**
 * Creates an account in the back office: an organization and its first
 * administrator, an account of an organization or of the REGLO team.
 */
export function AccountDialog({
    title,
    description,
    icon,
    ...form
}: AccountDialogProps) {
    const [open, setOpen] = useState(false);
    // Stable: the form stays mounted while the dialog closes, and must not
    // see a new callback (and show its message again) meanwhile.
    const close = useCallback(() => setOpen(false), []);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="transition duration-200">
                    {icon}
                    {title}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                {/* Mounted at each opening: the form starts empty. */}
                <AccountForm {...form} onDone={close} />
            </DialogContent>
        </Dialog>
    );
}

function AccountForm({
    submitLabel,
    action,
    withOrganizationName = false,
    withRole = false,
    organizationId,
    onDone,
}: Pick<
    AccountDialogProps,
    | "submitLabel"
    | "action"
    | "withOrganizationName"
    | "withRole"
    | "organizationId"
> & { onDone: () => void }) {
    const [state, formAction, isPending] = useActionState(action, {});
    // Controlled: what was typed stays in the fields after a refusal.
    const [values, setValues] = useState({
        name: "",
        email: "",
        firstName: "",
        lastName: "",
    });
    const [role, setRole] = useState<RoleKey>("member");
    useDoneMessage(state, onDone);

    function field(name: keyof typeof values) {
        return {
            id: `account-${name}`,
            name,
            value: values[name],
            onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                setValues({ ...values, [name]: event.target.value }),
            invalid: Boolean(state.fieldErrors?.[name]),
            errorId: "account-error",
        };
    }

    return (
        <form action={formAction} className="flex flex-col gap-5" noValidate>
            <FormError id="account-error" message={state.error} />
            {organizationId && (
                <input
                    type="hidden"
                    name="organizationId"
                    value={organizationId}
                />
            )}
            {withOrganizationName && (
                <FormField
                    label="Nom de l'organisation"
                    autoComplete="off"
                    maxLength={180}
                    required
                    {...field("name")}
                />
            )}
            <FormField
                label="Adresse e-mail"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="prenom.nom@entreprise.fr"
                maxLength={180}
                required
                {...field("email")}
            />
            <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                    label="Prénom"
                    autoComplete="off"
                    maxLength={100}
                    required
                    {...field("firstName")}
                />
                <FormField
                    label="Nom"
                    autoComplete="off"
                    maxLength={100}
                    required
                    {...field("lastName")}
                />
            </div>
            {withRole && (
                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="account-role"
                        className="text-base font-medium"
                    >
                        Rôle
                    </label>
                    <NativeSelect
                        id="account-role"
                        name="role"
                        value={role}
                        onChange={(event) =>
                            setRole(event.target.value as RoleKey)
                        }
                        aria-describedby="account-role-hint"
                    >
                        {ROLE_KEYS.map((key) => (
                            <option key={key} value={key}>
                                {ROLE_LABELS[key]}
                            </option>
                        ))}
                    </NativeSelect>
                    {/* Read with the field: changes with the chosen role. */}
                    <p
                        id="account-role-hint"
                        className="text-sm text-ink-muted"
                    >
                        {ROLE_DESCRIPTIONS[role]}
                    </p>
                </div>
            )}
            <SubmitRow isPending={isPending} label={submitLabel} />
        </form>
    );
}

/** Tells what happened, once, then closes the dialog. */
export function useDoneMessage(state: AdminFormState, onDone: () => void) {
    useEffect(() => {
        if (state.done) {
            toast.success(state.done);
            onDone();
        } else if (state.warning) {
            toast.warning(state.warning);
            onDone();
        }
    }, [state, onDone]);
}

export function FormError({
    id,
    message,
}: {
    id: string;
    message: string | undefined;
}) {
    if (!message) return null;

    return (
        <Alert variant="destructive" id={id}>
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{message}</AlertDescription>
        </Alert>
    );
}

export function SubmitRow({
    isPending,
    label,
    variant = "default",
    disabled = false,
}: {
    isPending: boolean;
    label: string;
    variant?: "default" | "destructive";
    disabled?: boolean;
}) {
    return (
        <div className="flex justify-end">
            <Button
                type="submit"
                variant={variant}
                disabled={isPending || disabled}
            >
                {isPending && (
                    <LoaderCircle aria-hidden="true" className="animate-spin" />
                )}
                {label}
            </Button>
        </div>
    );
}
