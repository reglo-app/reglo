import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    cacheComponents: true,
    partialPrefetching: true,
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
