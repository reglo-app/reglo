import { Skeleton } from "@/components/ui/skeleton";

/** Default page skeleton: header + a grid of blocks, never a blank page. */
export default function Loading() {
    return (
        <div aria-busy="true" aria-live="polite">
            <span className="sr-only">Chargement…</span>
            <div className="mb-8 flex flex-col gap-3">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-5 w-96 max-w-full" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-32 rounded-xl" />
                ))}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <Skeleton className="h-72 rounded-xl lg:col-span-2" />
                <Skeleton className="h-72 rounded-xl" />
            </div>
        </div>
    );
}
