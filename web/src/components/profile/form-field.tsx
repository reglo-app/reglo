import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";

export type FormFieldProps = ComponentProps<typeof Input> & {
    id: string;
    label: string;
    /** Help under the field, read with it by screen readers. */
    hint?: string;
    invalid?: boolean;
    /** Id of the error message of the form, linked when invalid. */
    errorId?: string;
};

/** Labelled input of the profile forms (label, hint, error link). */
export function FormField({
    id,
    label,
    hint,
    invalid = false,
    errorId,
    ...inputProps
}: FormFieldProps) {
    const describedBy = [
        hint ? `${id}-hint` : null,
        invalid && errorId ? errorId : null,
    ].filter(Boolean);

    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-base font-medium">
                {label}
            </label>
            <Input
                id={id}
                name={id}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy.join(" ") || undefined}
                {...inputProps}
            />
            {hint && (
                <p id={`${id}-hint`} className="text-sm text-ink-muted">
                    {hint}
                </p>
            )}
        </div>
    );
}
