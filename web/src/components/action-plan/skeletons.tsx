import { Skeleton } from "@/components/ui/skeleton";

/** While the members and the action of the form load. */
export function ActionFormSkeleton() {
    return (
        <div className="flex flex-col gap-6" aria-busy="true">
            <span className="sr-only">Chargement…</span>
            <Skeleton className="h-16" />
            <Skeleton className="h-32" />
            <div className="grid gap-6 sm:grid-cols-2">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
            </div>
        </div>
    );
}

/** While one action loads. */
export function ActionDetailSkeleton() {
    return (
        <div className="flex flex-col gap-6" aria-busy="true">
            <span className="sr-only">Chargement…</span>
            <Skeleton className="h-10 w-1/2" />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <Skeleton className="h-72 rounded-lg" />
                <Skeleton className="h-72 rounded-lg" />
            </div>
        </div>
    );
}
