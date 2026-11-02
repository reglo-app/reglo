import type { CurrentUser } from "@/lib/api";

/** Same limits as the API (AvatarStorage): checked first here for speed. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * URL of the profile photo, served by app/avatars/[userId]/route.ts. The
 * version changes with each new photo, so a cached old one is never shown.
 */
export function avatarUrl(
    user: Pick<CurrentUser, "id" | "avatarVersion">,
): string | null {
    return user.avatarVersion
        ? `/avatars/${encodeURIComponent(user.id)}?v=${encodeURIComponent(user.avatarVersion)}`
        : null;
}

/** "Camille Martin" → "CM": shown when there is no photo. */
export function initials(fullName: string): string {
    return fullName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("");
}
