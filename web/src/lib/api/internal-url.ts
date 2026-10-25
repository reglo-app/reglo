/**
 * URL of the API seen from the Next.js server. Only the server calls the API
 * (server components and actions), never the browser: in Docker it is the
 * API service name, not the public URL.
 */
export const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "";
