import * as React from "react";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

// Charter: `[icon] Section / [icon] Page / Detail`, each item a link with its
// page icon, last item not clickable, text ink-muted, separator `/`.

function Breadcrumb({ className, ...props }: React.ComponentProps<"nav">) {
    return (
        <nav
            aria-label="Fil d'Ariane"
            data-slot="breadcrumb"
            className={cn(className)}
            {...props}
        />
    );
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
    return (
        <ol
            data-slot="breadcrumb-list"
            className={cn(
                "flex flex-wrap items-center gap-1 text-sm text-ink-muted",
                className,
            )}
            {...props}
        />
    );
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
    return (
        <li
            data-slot="breadcrumb-item"
            className={cn("inline-flex items-center", className)}
            {...props}
        />
    );
}

function BreadcrumbLink({
    asChild,
    className,
    ...props
}: React.ComponentProps<"a"> & {
    asChild?: boolean;
}) {
    const Comp = asChild ? Slot.Root : "a";

    return (
        <Comp
            data-slot="breadcrumb-link"
            className={cn(
                // Shopify-like hover: very light green background, light shadow.
                "inline-flex min-h-8.75 items-center gap-1.5 rounded-md px-2 transition-[color,background-color,box-shadow] duration-200 hover:bg-brand-green/10 hover:text-ink [&_svg]:size-4 [&_svg]:shrink-0",
                className,
            )}
            {...props}
        />
    );
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
    return (
        <span
            data-slot="breadcrumb-page"
            aria-current="page"
            className={cn(
                "inline-flex min-h-10 items-center gap-1.5 px-2 font-medium text-ink [&_svg]:size-4 [&_svg]:shrink-0",
                className,
            )}
            {...props}
        />
    );
}

function BreadcrumbSeparator({
    children,
    className,
    ...props
}: React.ComponentProps<"li">) {
    return (
        <li
            data-slot="breadcrumb-separator"
            role="presentation"
            aria-hidden="true"
            // 2px larger than the links so the "/" is easier to see.
            className={cn("px-0.5 text-base text-border-strong", className)}
            {...props}
        >
            {children ?? "/"}
        </li>
    );
}

export {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
};
