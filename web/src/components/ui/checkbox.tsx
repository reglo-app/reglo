"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Real checkbox restyled (keyboard, label and checked state stay native);
 * the tick is a Lucide icon on top, smaller than the browser's one. With
 * `indeterminate`, a dash means "some of them" (select all of a table).
 */
function Checkbox({
    className,
    indeterminate = false,
    ref,
    ...props
}: Omit<ComponentProps<"input">, "type"> & { indeterminate?: boolean }) {
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        // Only settable from script.
        if (inputRef.current) inputRef.current.indeterminate = indeterminate;
    }, [indeterminate]);

    return (
        <span
            className={cn(
                "relative flex size-4 shrink-0 items-center justify-center",
                className,
            )}
        >
            <input
                ref={(node) => {
                    inputRef.current = node;
                    if (typeof ref === "function") ref(node);
                    else if (ref) ref.current = node;
                }}
                type="checkbox"
                data-slot="checkbox"
                className="peer size-4 cursor-pointer appearance-none rounded-sm border border-border-strong bg-white transition-colors duration-200 checked:border-green-700 checked:bg-green-700 indeterminate:border-green-700 indeterminate:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40"
                {...props}
            />
            <Check
                aria-hidden="true"
                strokeWidth={3}
                className="pointer-events-none absolute size-3 text-white opacity-0 transition-opacity duration-200 peer-checked:opacity-100 peer-indeterminate:opacity-0"
            />
            <Minus
                aria-hidden="true"
                strokeWidth={3}
                className="pointer-events-none absolute size-3 text-white opacity-0 transition-opacity duration-200 peer-indeterminate:opacity-100"
            />
        </span>
    );
}

export { Checkbox };
