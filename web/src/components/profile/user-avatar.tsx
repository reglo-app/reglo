/* eslint-disable @next/next/no-img-element -- private image served by a
   route handler: next/image would cache it on the server, across users. */
import type { CurrentUser } from "@/lib/api";
import { avatarUrl, initials } from "@/lib/profile/avatar";
import { cn } from "@/lib/utils";

const SIZES = {
    sm: "size-8 text-xs",
    lg: "size-20 text-2xl",
};

/**
 * Round profile photo, or the initials without photo. Decorative: the name
 * is always written next to it.
 */
export function UserAvatar({
    user,
    fullName,
    size = "sm",
}: {
    user: Pick<CurrentUser, "id" | "avatarVersion">;
    fullName: string;
    size?: keyof typeof SIZES;
}) {
    const url = avatarUrl(user);
    const className = cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-teal font-semibold text-white",
        SIZES[size],
    );

    return url ? (
        <img
            src={url}
            alt=""
            aria-hidden="true"
            className={cn(className, "object-cover")}
        />
    ) : (
        <span aria-hidden="true" className={className}>
            {initials(fullName)}
        </span>
    );
}
