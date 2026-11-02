import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    cacheComponents: true,
    partialPrefetching: true,
    experimental: {
        // Profile photos go through a server action: 5 MB image plus the
        // form overhead (the API checks the real limit).
        serverActions: { bodySizeLimit: "6mb" },
    },
    // The home page is the dashboard.
    async redirects() {
        return [{ source: "/", destination: "/dashboard", permanent: false }];
    },
    turbopack: {
        rules: {
            "*.css": {
                loaders: ["@tailwindcss/turbopack"],
                as: "*.css",
            },
        },
    },
};

export default nextConfig;
