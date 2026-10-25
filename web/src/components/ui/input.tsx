import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                // Focus: coloured border plus a soft halo instead of the
                // global outline (the border keeps a strong contrast).
                "h-10 w-full min-w-0 rounded-md border border-border-strong bg-white px-3 text-base text-ink shadow-xs transition-[color,border-color,box-shadow] duration-200 placeholder:text-ink-muted/70 focus-visible:border-green-600 focus-visible:ring-4 focus-visible:ring-brand-green/20 focus-visible:outline-none aria-invalid:focus-visible:ring-danger/20 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:opacity-60 aria-invalid:border-danger file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink",
                className,
            )}
            {...props}
        />
    );
}

export { Input };
