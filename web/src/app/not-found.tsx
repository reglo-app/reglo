import { NotFoundMessage } from "@/components/not-found-message";

/** Rendered for any URL that matches no route. */
export default function NotFound() {
    return (
        <main className="flex flex-1 items-center justify-center px-4">
            <NotFoundMessage />
        </main>
    );
}
