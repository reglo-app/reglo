import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

// Charter: a state always has a word (the badge label), never colour alone.
const badgeVariants = cva(
    "inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-sm px-2 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5",
    {
        variants: {
            variant: {
                default: "bg-brand-teal text-white",
                secondary: "bg-teal-50 text-ink",
                outline: "border border-border text-ink",
                success: "bg-green-50 text-green-700",
                warning: "bg-yellow-50 text-yellow-900",
                info: "bg-blue-50 text-blue-800",
                destructive: "bg-danger-50 text-danger-700",
                // QHSE domains: tinted chip + coloured dot (see DomainBadge).
                quality: "bg-quality-50 text-ink",
                hygiene: "bg-hygiene-50 text-ink",
                safety: "bg-safety-50 text-ink",
                environment: "bg-environment-50 text-ink",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
);

function Badge({
    className,
    variant = "default",
    asChild = false,
    ...props
}: React.ComponentProps<"span"> &
    VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
    const Comp = asChild ? Slot.Root : "span";

    return (
        <Comp
            data-slot="badge"
            data-variant={variant}
            className={cn(badgeVariants({ variant }), className)}
            {...props}
        />
    );
}

export { Badge, badgeVariants };
