import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Native <select> (keyboard, screen readers and mobile pickers for free)
 * with the look of Input. The browser arrow is replaced by an icon placed
 * like the padding of the field.
 */
function NativeSelect({
    className,
    wrapperClassName,
    ...props
}: ComponentProps<"select"> & { wrapperClassName?: string }) {
    return (
        <div className={cn("relative", wrapperClassName)}>
            <select
                data-slot="native-select"
                className={cn(
                    "h-10 w-full min-w-0 appearance-none rounded-md border border-border-strong bg-white pr-9 pl-3 text-base text-ink shadow-xs transition-[color,border-color,box-shadow] duration-200 focus-visible:border-green-600 focus-visible:ring-4 focus-visible:ring-brand-green/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger",
                    className,
                )}
                {...props}
            />
            <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted"
            />
        </div>
    );
}

export { NativeSelect };
