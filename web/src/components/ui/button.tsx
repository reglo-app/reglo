import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent text-base font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
    {
        variants: {
            variant: {
                // Primary action: one per page header.
                default: "bg-brand-gradient text-white hover:brightness-90",
                // Highlight action (charter: yellow fill with teal text).
                highlight:
                    "bg-brand-yellow text-brand-teal hover:bg-brand-yellow/85",
                secondary: "bg-teal-50 text-ink hover:bg-green-50",
                // Bordered at rest, very light green on hover.
                outline:
                    "border-border bg-white text-ink hover:border-border-strong hover:bg-green-50",
                ghost: "text-ink hover:bg-green-50",
                destructive: "bg-danger text-white hover:bg-danger-700",
                link: "link-underline h-auto px-0 text-green-700",
                // Topbar controls (menu toggle, search, notifications):
                // compact, light border and small shadow; on hover a darker
                // border, very light green and a slightly larger shadow.
                toolbar:
                    "rounded-(--radius-control) border border-border bg-white text-sm font-semibold text-ink shadow-xs transition-[color,background-color,border-color,box-shadow] duration-300 hover:bg-green-50/1",
                seeAll: "rounded-(--radius-control) border border-border bg-white text-sm font-semibold text-ink shadow-xs transition-[color,background-color,border-color,box-shadow] duration-300 hover:bg-green-50/30",
            },
            size: {
                // Charter: interactive controls are at least 40px high.
                default: "h-10 px-4",
                lg: "h-11 px-5 text-lg",
                icon: "size-10",
                // Topbar: 7px vertical / 12px horizontal padding, 36px high.
                toolbar:
                    "px-3 py-[7px] leading-5 [&_svg:not([class*='size-'])]:size-4",
                "toolbar-icon": "p-[7px] [&_svg:not([class*='size-'])]:size-5",
                seeAll: "px-3 py-[5px] leading-5 [&_svg:not([class*='size-'])]:size-4",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    },
);

function Button({
    className,
    variant = "default",
    size = "default",
    asChild = false,
    ...props
}: React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    }) {
    const Comp = asChild ? Slot.Root : "button";

    return (
        <Comp
            data-slot="button"
            data-variant={variant}
            data-size={size}
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };
