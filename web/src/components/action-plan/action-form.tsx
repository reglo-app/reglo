"use client";

import {
    startTransition,
    useActionState,
    useEffect,
    useRef,
    useState,
} from "react";
import Link from "next/link";
import { CircleAlert, LoaderCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
    saveAction,
    type ActionField,
    type ActionFormState,
} from "@/lib/action-plan/actions";
import {
    personName,
    TYPE_DESCRIPTIONS,
    TYPE_LABELS,
} from "@/lib/action-plan/labels";
import {
    ACTION_TYPES,
    type Action,
    type ActionType,
    type Member,
} from "@/lib/api/types";
import { DOMAIN_KEYS, DOMAINS, type DomainKey } from "@/lib/domains";

export const TITLE_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 2000;

export type ActionFormValues = {
    title: string;
    description: string;
    domain: DomainKey | "";
    type: ActionType | "";
    assigneeId: string;
    dueDate: string;
};

export type ActionFormProps = {
    /** The action changed; none for a new one. */
    action?: Action;
    /** Prefilled values of a new action (e.g. from the diagnostic result). */
    defaults?: Partial<ActionFormValues>;
    /** Members of the organization: those who can be responsible are offered. */
    members: Member[];
    /** "YYYY-MM-DD": the earliest due date (the API refuses the past). */
    today: string;
    /** Injected in tests; the server action by default. */
    save?: typeof saveAction;
};

const ORDER: ActionField[] = [
    "title",
    "description",
    "domain",
    "type",
    "assigneeId",
    "dueDate",
];

/**
 * Creation and change of an action (US-09). Every field has its label and,
 * when refused, its own message linked with aria-describedby; the first
 * refused field gets the focus.
 */
export function ActionForm({
    action,
    defaults = {},
    members,
    today,
    save = saveAction,
}: ActionFormProps) {
    const [state, formAction, isPending] = useActionState<
        ActionFormState,
        FormData
    >(save.bind(null, action?.id ?? null), {});
    // Controlled: a refused form keeps what was typed.
    const [values, setValues] = useState<ActionFormValues>({
        title: action?.title ?? defaults.title ?? "",
        description: action?.description ?? defaults.description ?? "",
        domain: action?.domain ?? defaults.domain ?? "",
        type: action?.type ?? defaults.type ?? "",
        assigneeId: action?.assignee?.id ?? defaults.assigneeId ?? "",
        dueDate: action?.dueDate ?? defaults.dueDate ?? "",
    });
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        const first = ORDER.find((name) => state.fieldErrors?.[name]);
        if (first) {
            formRef.current
                ?.querySelector<HTMLElement>(`[name="${first}"]`)
                ?.focus();
        }
    }, [state]);

    // Who can be responsible: activated administrators and members (the
    // API refuses readers). The current assignee stays in the list.
    const candidates = members.filter(
        (member) =>
            (member.activated && member.role !== "reader") ||
            member.id === action?.assignee?.id,
    );
    const pastDueDate =
        action !== undefined && action.dueDate < today ? action.dueDate : null;

    // Sent by hand: a form action would reset the form after a refusal,
    // and the selects would show their placeholder again.
    function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
    }

    function field(name: ActionField, hasHint = false) {
        const error = state.fieldErrors?.[name];
        const describedBy = [
            hasHint ? `action-${name}-hint` : null,
            error ? `action-${name}-error` : null,
        ].filter(Boolean);
        return {
            id: `action-${name}`,
            name,
            value: values[name],
            onChange: (
                event: React.ChangeEvent<
                    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
                >,
            ) => setValues({ ...values, [name]: event.target.value }),
            "aria-invalid": error ? true : undefined,
            "aria-describedby": describedBy.join(" ") || undefined,
        };
    }

    return (
        <form
            ref={formRef}
            onSubmit={submit}
            className="flex flex-col gap-6"
            noValidate
        >
            {state.error && (
                <Alert variant="destructive">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            )}

            <Field
                name="title"
                label="Titre"
                hint={`Une phrase qui dit quoi faire, ${TITLE_MAX_LENGTH} caractères maximum.`}
                error={state.fieldErrors?.title}
            >
                <Input
                    {...field("title", true)}
                    maxLength={TITLE_MAX_LENGTH}
                    autoComplete="off"
                    required
                />
            </Field>

            <Field
                name="description"
                label="Description (facultatif)"
                hint="Le contexte, les étapes, ce qui prouvera que c'est fait."
                error={state.fieldErrors?.description}
            >
                <textarea
                    {...field("description", true)}
                    maxLength={DESCRIPTION_MAX_LENGTH}
                    rows={4}
                    className="min-h-24 w-full min-w-0 rounded-md border border-border-strong bg-white px-3 py-2 text-base text-ink shadow-xs transition-[color,border-color,box-shadow] duration-200 placeholder:text-ink-muted/70 focus-visible:border-green-600 focus-visible:ring-4 focus-visible:ring-brand-green/20 focus-visible:outline-none aria-invalid:border-danger"
                />
            </Field>

            <div className="grid gap-6 sm:grid-cols-2">
                <Field
                    name="domain"
                    label="Domaine"
                    error={state.fieldErrors?.domain}
                >
                    <NativeSelect {...field("domain")} required>
                        <option value="" disabled>
                            Choisissez un domaine
                        </option>
                        {DOMAIN_KEYS.map((key) => (
                            <option key={key} value={key}>
                                {DOMAINS[key].label}
                            </option>
                        ))}
                    </NativeSelect>
                </Field>

                <Field
                    name="type"
                    label="Type"
                    hint={
                        values.type
                            ? TYPE_DESCRIPTIONS[values.type]
                            : "Corrective, préventive ou amélioration."
                    }
                    error={state.fieldErrors?.type}
                >
                    <NativeSelect {...field("type", true)} required>
                        <option value="" disabled>
                            Choisissez un type
                        </option>
                        {ACTION_TYPES.map((key) => (
                            <option key={key} value={key}>
                                {TYPE_LABELS[key]}
                            </option>
                        ))}
                    </NativeSelect>
                </Field>

                <Field
                    name="assigneeId"
                    label="Responsable"
                    hint="Reçoit un e-mail quand l'action lui est confiée."
                    error={state.fieldErrors?.assigneeId}
                >
                    <NativeSelect {...field("assigneeId", true)} required>
                        <option value="" disabled>
                            Choisissez un membre
                        </option>
                        {candidates.map((member) => (
                            <option key={member.id} value={member.id}>
                                {personName(member)}
                                {member.jobTitle ? ` (${member.jobTitle})` : ""}
                            </option>
                        ))}
                    </NativeSelect>
                </Field>

                <Field
                    name="dueDate"
                    label="Échéance"
                    hint={
                        pastDueDate
                            ? "Déjà dépassée : gardez-la ou choisissez une date à venir."
                            : "Aujourd'hui ou plus tard."
                    }
                    error={state.fieldErrors?.dueDate}
                >
                    <Input
                        {...field("dueDate", true)}
                        type="date"
                        min={pastDueDate ?? today}
                        required
                    />
                </Field>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button asChild variant="outline">
                    <Link href={action ? `/actions/${action.id}` : "/actions"}>
                        Annuler
                    </Link>
                </Button>
                <Button type="submit" disabled={isPending}>
                    {isPending && (
                        <LoaderCircle
                            aria-hidden="true"
                            className="animate-spin"
                        />
                    )}
                    {isPending
                        ? "Enregistrement…"
                        : action
                          ? "Enregistrer les modifications"
                          : "Créer l'action"}
                </Button>
            </div>
        </form>
    );
}

/** Label, help and error message of one field. */
function Field({
    name,
    label,
    hint,
    error,
    children,
}: {
    name: ActionField;
    label: string;
    hint?: string;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={`action-${name}`} className="text-base font-medium">
                {label}
            </label>
            {children}
            {hint && (
                <p
                    id={`action-${name}-hint`}
                    className="text-sm text-ink-muted"
                >
                    {hint}
                </p>
            )}
            {error && (
                <p
                    id={`action-${name}-error`}
                    className="flex items-start gap-1.5 text-sm font-medium text-danger-700"
                >
                    <CircleAlert
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                    />
                    {error}
                </p>
            )}
        </div>
    );
}
