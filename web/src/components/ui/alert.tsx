import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
    "relative grid w-full gap-0.5 rounded-lg border px-4 py-3 text-left text-sm text-ink has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3 *:[svg]:row-span-2 *:[svg:not([class*='size-'])]:size-5",
    {
        variants: {
            variant: {
                default: "border-border bg-white *:[svg]:text-ink",
                info: "border-blue-50 bg-blue-50 *:[svg]:text-blue-700",
                success: "border-green-50 bg-green-50 *:[svg]:text-green-700",
                warning:
                    "border-yellow-50 bg-yellow-50 *:[svg]:text-yellow-900",
                destructive:
                    "border-danger-50 bg-danger-50 text-danger-700 *:[svg]:text-danger-700",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
);

function Alert({
    className,
    variant,
    ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
    return (
        <div
            data-slot="alert"
            role="alert"
            className={cn(alertVariants({ variant }), className)}
            {...props}
        />
    );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-title"
            className={cn("font-semibold [&_a]:underline", className)}
            {...props}
        />
    );
}

function AlertDescription({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="alert-description"
            className={cn("text-sm text-pretty [&_a]:underline", className)}
            {...props}
        />
    );
}

export { Alert, AlertTitle, AlertDescription };
