/** Page shown after login when no (valid) target is given. */
export const DEFAULT_AFTER_LOGIN = "/dashboard";

/**
 * Returns `target` only if it is a path on this site. Blocks open redirects
 * such as "//evil.test", "/\evil.test" or "https://evil.test".
 */
export function safeRedirectPath(target: unknown): string {
    if (
        typeof target !== "string" ||
        !target.startsWith("/") ||
        target.startsWith("//") ||
        target.startsWith("/\\") ||
        target.startsWith("/login") ||
        // It signs out: never a page to open after login.
        target.startsWith("/session-expired")
    ) {
        return DEFAULT_AFTER_LOGIN;
    }

    return target;
}
