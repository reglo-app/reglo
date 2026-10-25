import { UserMenu } from "@/components/shell/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLE_LABELS, api } from "@/lib/api";

/** Loads the signed-in user and renders the topbar user menu. */
export async function CurrentUserMenu() {
    const user = await api.getCurrentUser();
    // The e-mail stands in for the name until accounts have one (US-01).
    const fullName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

    return (
        <UserMenu
            fullName={fullName}
            roleLabel={ROLE_LABELS[user.role]}
            organizationName={user.organization?.name ?? null}
        />
    );
}

export function CurrentUserMenuSkeleton() {
    return (
        <div aria-hidden="true">
            <Skeleton className="ml-2 size-8 rounded-full" />
        </div>
    );
}
