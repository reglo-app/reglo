import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api";

/**
 * The API decides who enters the back office. For anybody else, it does not
 * exist: same page as a wrong address.
 */
export async function orNotFoundWhenRefused<T>(call: Promise<T>): Promise<T> {
    try {
        return await call;
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) notFound();
        throw error;
    }
}
