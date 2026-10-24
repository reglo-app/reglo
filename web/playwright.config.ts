import { defineConfig } from "@playwright/test";

// E2E_BASE_URL lets you target a server on another port (default: 3000).
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
    testDir: "./e2e",
    use: {
        baseURL,
        // Signed in by default: the proxy only checks that the session
        // cookie exists, and pages use mock data. login.spec.ts starts
        // signed out.
        storageState: {
            cookies: [
                {
                    name: "reglo_session",
                    value: "e2e",
                    domain: new URL(baseURL).hostname,
                    path: "/",
                    expires: -1,
                    httpOnly: true,
                    secure: false,
                    sameSite: "Lax",
                },
            ],
            origins: [],
        },
    },
    webServer: {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
    },
});
