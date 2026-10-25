"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Tabs({
    className,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
    return (
        <TabsPrimitive.Root
            data-slot="tabs"
            className={cn("flex flex-col gap-6", className)}
            {...props}
        />
    );
}

const tabsListVariants = cva(
    "group/tabs-list inline-flex w-fit max-w-full items-center overflow-x-auto overflow-y-hidden",
    {
        variants: {
            variant: {
                // Pill tabs on a white track.
                default: "gap-1 rounded-lg border border-border bg-white p-1",
                // Underlined tabs. Each trigger can set its accent with
                // `[--tab-accent:var(--color-quality)]`.
                line: "gap-2 border-b border-border",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
);

function TabsList({
    className,
    variant = "default",
    ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
    VariantProps<typeof tabsListVariants>) {
    return (
        <TabsPrimitive.List
            data-slot="tabs-list"
            data-variant={variant}
            className={cn(tabsListVariants({ variant }), className)}
            {...props}
        />
    );
}

function TabsTrigger({
    className,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
    return (
        <TabsPrimitive.Trigger
            data-slot="tabs-trigger"
            className={cn(
                "relative inline-flex h-10 shrink-0 items-center justify-center gap-2 px-4 text-base font-medium whitespace-nowrap text-ink-muted transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
                // default variant
                "group-data-[variant=default]/tabs-list:rounded-md group-data-[variant=default]/tabs-list:data-[state=active]:bg-brand-teal group-data-[variant=default]/tabs-list:data-[state=active]:text-white",
                // line variant
                "group-data-[variant=line]/tabs-list:data-[state=active]:text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-1 after:rounded-full after:bg-(--tab-accent,var(--color-brand-teal)) after:opacity-0 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
                className,
            )}
            {...props}
        />
    );
}

function TabsContent({
    className,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
    return (
        <TabsPrimitive.Content
            data-slot="tabs-content"
            className={cn("flex-1", className)}
            {...props}
        />
    );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
