import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Charter: white cards on surface-subtle. Tinted tones give each dashboard
// block its own colour (inspiration captures 1, 2, 4, 5).
const cardVariants = cva(
    "flex flex-col gap-4 overflow-hidden rounded-lg py-5 text-sm",
    {
        variants: {
            tone: {
                default: "border border-border bg-white text-ink",
                brand: "bg-brand-gradient text-white",
                quality: "bg-quality-50 text-ink",
                hygiene: "bg-hygiene-50 text-ink",
                safety: "bg-safety-50 text-ink",
                environment: "bg-environment-50 text-ink",
            },
        },
        defaultVariants: {
            tone: "default",
        },
    },
);

function Card({
    className,
    tone = "default",
    ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
    return (
        <div
            data-slot="card"
            data-tone={tone}
            className={cn(cardVariants({ tone }), className)}
            {...props}
        />
    );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-header"
            className={cn(
                "grid auto-rows-min items-start gap-1 px-5 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
                className,
            )}
            {...props}
        />
    );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-title"
            className={cn("text-lg leading-snug font-semibold", className)}
            {...props}
        />
    );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-description"
            className={cn(
                "text-sm text-ink-muted in-data-[tone=brand]:text-white",
                className,
            )}
            {...props}
        />
    );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-action"
            className={cn(
                "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
                className,
            )}
            {...props}
        />
    );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-content"
            className={cn("px-5", className)}
            {...props}
        />
    );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="card-footer"
            className={cn("flex items-center gap-2 px-5", className)}
            {...props}
        />
    );
}

export {
    Card,
    CardHeader,
    CardFooter,
    CardTitle,
    CardAction,
    CardDescription,
    CardContent,
    cardVariants,
};
