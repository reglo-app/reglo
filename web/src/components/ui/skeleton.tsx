import { cn } from "cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="skeleton"
            className={cn(
                "animate-pulse rounded-md bg-teal-50 motion-reduce:animate-none",
                className,
            )}
            {...props}
        />
    );
}

export { Skeleton };
