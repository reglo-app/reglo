import { afterEach, describe, expect, it, vi } from "vitest";

import { isAccessTokenValid } from "@/lib/auth/api";
import { clearSession, getSessionToken } from "@/lib/auth/session";

import { GET } from "./route";

vi.mock("@/lib/auth/session", () => ({
    getSessionToken: vi.fn(),
    clearSession: vi.fn(),
}));
vi.mock("@/lib/auth/api", () => ({ isAccessTokenValid: vi.fn() }));
// redirect() never returns: it throws, like in Next.js.
vi.mock("next/navigation", () => ({
    redirect: vi.fn((url: string) => {
        throw new Error(`redirect:${url}`);
    }),
}));

afterEach(() => {
    vi.clearAllMocks();
});

describe("GET /session-expired", () => {
    it("forgets a token the API refuses and opens the login page", async () => {
        vi.mocked(getSessionToken).mockResolvedValue("revoked");
        vi.mocked(isAccessTokenValid).mockResolvedValue(false);

        await expect(GET()).rejects.toThrow("redirect:/login");
        expect(clearSession).toHaveBeenCalledOnce();
    });

    it("keeps a valid session: a link to this page cannot sign out", async () => {
        vi.mocked(getSessionToken).mockResolvedValue("valid");
        vi.mocked(isAccessTokenValid).mockResolvedValue(true);

        await expect(GET()).rejects.toThrow("redirect:/dashboard");
        expect(clearSession).not.toHaveBeenCalled();
    });

    it("opens the login page when there is no session", async () => {
        vi.mocked(getSessionToken).mockResolvedValue(null);

        await expect(GET()).rejects.toThrow("redirect:/login");
        expect(isAccessTokenValid).not.toHaveBeenCalled();
    });
});
