"use client";

import {
    CircleCheckIcon,
    InfoIcon,
    Loader2Icon,
    OctagonXIcon,
    TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// Charter: toast after save, at the bottom, 4 seconds. Use `toast()` from
// "sonner" to show one.
function Toaster(props: ToasterProps) {
    return (
        <Sonner
            theme="light"
            position="bottom-right"
            duration={4000}
            containerAriaLabel="Notifications"
            icons={{
                success: <CircleCheckIcon className="size-5 text-green-700" />,
                info: <InfoIcon className="size-5 text-blue-700" />,
                warning: (
                    <TriangleAlertIcon className="size-5 text-yellow-900" />
                ),
                error: <OctagonXIcon className="size-5 text-danger" />,
                loading: <Loader2Icon className="size-5 animate-spin" />,
            }}
            style={
                {
                    "--normal-bg": "var(--color-white)",
                    "--normal-text": "var(--color-ink)",
                    "--normal-border": "var(--color-border)",
                    "--border-radius": "var(--radius-md)",
                    fontFamily: "var(--font-sans)",
                } as React.CSSProperties
            }
            {...props}
        />
    );
}

export { Toaster };
