import type { CurrentUser } from "@/lib/api";

/** Same limits as the API (AvatarStorage): checked first here for speed. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Largest photo the user can choose: the browser reduces it below
 * AVATAR_MAX_BYTES before sending it (phone photos often weigh more).
 */
export const AVATAR_SOURCE_MAX_BYTES = 20 * 1024 * 1024;

/** Largest side of the reduced photo; the API crops it to 256 px. */
const UPLOAD_SIZE = 1024;

const megabytes = (bytes: number) => bytes / 1024 / 1024;

export const AVATAR_MESSAGES = {
    missingImage: "Choisissez une image.",
    invalidImage: "Choisissez une image JPEG, PNG ou WebP.",
    tooLarge: `L'image ne doit pas dépasser ${megabytes(AVATAR_MAX_BYTES)} Mo.`,
    sourceTooLarge: `L'image ne doit pas dépasser ${megabytes(AVATAR_SOURCE_MAX_BYTES)} Mo.`,
};

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

/**
 * Photo chosen by the user, made ready to send (browser only): reduced to
 * UPLOAD_SIZE, so it stays far below the server action body limit, and
 * turned upright (phone photos keep their rotation in their metadata).
 * The API still checks the real type and re-encodes it.
 */
export async function prepareAvatar(
    file: File,
): Promise<{ file: File } | { error: string }> {
    if (!AVATAR_TYPES.includes(file.type)) {
        return { error: AVATAR_MESSAGES.invalidImage };
    }
    if (file.size > AVATAR_SOURCE_MAX_BYTES) {
        return { error: AVATAR_MESSAGES.sourceTooLarge };
    }

    const reduced = await reduceImage(file).catch(() => null);
    if (reduced) {
        return { file: reduced };
    }
    // Not decoded here (old browser, unreadable file): sent as is when
    // small enough, the API gives the final answer.
    return file.size > AVATAR_MAX_BYTES
        ? { error: AVATAR_MESSAGES.tooLarge }
        : { file };
}

async function reduceImage(file: File): Promise<File | null> {
    if (typeof createImageBitmap !== "function") {
        return null;
    }
    // Applies the orientation of the photo metadata.
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
        1,
        UPLOAD_SIZE / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
        bitmap.close();
        return null;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    // Browsers that cannot encode WebP give a PNG, also accepted.
    const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.9),
    );
    if (
        !blob ||
        !AVATAR_TYPES.includes(blob.type) ||
        blob.size > AVATAR_MAX_BYTES
    ) {
        return null;
    }
    return new File([blob], `photo.${blob.type.split("/")[1]}`, {
        type: blob.type,
    });
}
