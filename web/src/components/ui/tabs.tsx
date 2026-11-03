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
                // Full-width bar of equal tabs on a light track (settings
                // page). A white indicator slides under the active tab, in
                // CSS only: one column wide, moved by the index of the
                // active tab (up to 4 tabs).
                segmented: [
                    "relative isolate grid w-full auto-cols-fr grid-flow-col gap-1 rounded-lg bg-teal-50 p-1",
                    "[--tab-count:1] [&:has(>[role=tab]:nth-child(2))]:[--tab-count:2] [&:has(>[role=tab]:nth-child(3))]:[--tab-count:3] [&:has(>[role=tab]:nth-child(4))]:[--tab-count:4]",
                    "[--tab-index:0] [&:has(>[data-state=active]:nth-child(2))]:[--tab-index:1] [&:has(>[data-state=active]:nth-child(3))]:[--tab-index:2] [&:has(>[data-state=active]:nth-child(4))]:[--tab-index:3]",
                    "before:absolute before:inset-y-1 before:left-1 before:-z-10 before:w-[calc((100%_-_0.5rem_-_(var(--tab-count)_-_1)_*_0.25rem)_/_var(--tab-count))] before:translate-x-[calc(var(--tab-index)_*_(100%_+_0.25rem))] before:rounded-md before:bg-white before:shadow-xs before:transition-transform before:duration-300 before:ease-out motion-reduce:before:transition-none",
                ].join(" "),
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
    onPointerDown,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
    VariantProps<typeof tabsListVariants>) {
    // Radix focuses the clicked tab, which the browser then outlines as a
    // keyboard focus. The outline is kept for the keyboard only (RGAA).
    const [input, setInput] = React.useState<"keyboard" | "pointer">(
        "keyboard",
    );

    // Any key, even outside the list (Tab back to it), shows it again.
    React.useEffect(() => {
        const showOutline = () => setInput("keyboard");
        window.addEventListener("keydown", showOutline);
        return () => window.removeEventListener("keydown", showOutline);
    }, []);

    return (
        <TabsPrimitive.List
            data-slot="tabs-list"
            data-variant={variant}
            data-input={input}
            className={cn(tabsListVariants({ variant }), className)}
            onPointerDown={(event) => {
                setInput("pointer");
                onPointerDown?.(event);
            }}
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
                // No focus outline after a click (see TabsList)
                "group-data-[input=pointer]/tabs-list:outline-none",
                // default variant
                "group-data-[variant=default]/tabs-list:rounded-md group-data-[variant=default]/tabs-list:data-[state=active]:bg-brand-teal group-data-[variant=default]/tabs-list:data-[state=active]:text-white",
                // segmented variant (the white background is the sliding
                // indicator of the list)
                "group-data-[variant=segmented]/tabs-list:rounded-md group-data-[variant=segmented]/tabs-list:transition-colors group-data-[variant=segmented]/tabs-list:duration-300 group-data-[variant=segmented]/tabs-list:data-[state=active]:text-ink",
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
