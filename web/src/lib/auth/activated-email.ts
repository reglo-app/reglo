/**
 * E-mail of the account just activated, handed from the activation page to
 * the login page it redirects to. Session storage: same tab only, gone when
 * the tab closes, and never in the URL.
 */
export const ACTIVATED_EMAIL_KEY = "reglo.activatedEmail";

export function storeActivatedEmail(email: string) {
    try {
        window.sessionStorage.setItem(ACTIVATED_EMAIL_KEY, email);
    } catch {
        // Storage can be blocked: the user just types the e-mail.
    }
}

export function readActivatedEmail(): string | null {
    try {
        return window.sessionStorage.getItem(ACTIVATED_EMAIL_KEY);
    } catch {
        return null;
    }
}

export function clearActivatedEmail() {
    try {
        window.sessionStorage.removeItem(ACTIVATED_EMAIL_KEY);
    } catch {
        // Nothing to clear.
    }
}
