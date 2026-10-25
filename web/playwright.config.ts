import { defineConfig } from "@playwright/test";

// The tests start their own server, with every feature on mock data: the
// signed-in pages then never call the API (the session cookie below is not a
// real token). Port 3100, so the Docker dev server (port 3000, real API for
// the signed-in user) is never reused. E2E_BASE_URL targets another server
// instead, which must run with API_MOCKS=all.
const PORT = 3100;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

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
    webServer: process.env.E2E_BASE_URL
        ? undefined
        : {
              command: `npm run dev -- --port ${PORT}`,
              url: baseURL,
              reuseExistingServer: !process.env.CI,
              env: { API_MOCKS: "all" },
          },
});
