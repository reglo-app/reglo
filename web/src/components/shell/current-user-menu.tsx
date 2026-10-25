import { UserMenu } from "@/components/shell/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLE_LABELS, api } from "@/lib/api";

/** Loads the signed-in user and renders the topbar user menu. */
export async function CurrentUserMenu() {
    const user = await api.getCurrentUser();

    return (
        <UserMenu
            fullName={`${user.firstName} ${user.lastName}`}
            roleLabel={ROLE_LABELS[user.role]}
            organizationName={user.organization.name}
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
