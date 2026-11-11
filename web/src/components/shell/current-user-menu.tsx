import {
    InterfaceSwitch,
    type InterfaceKey,
} from "@/components/shell/interface-switch";
import { UserMenu } from "@/components/shell/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { PLATFORM_ROLE_LABEL, ROLE_LABELS, api } from "@/lib/api";

/**
 * Loads the signed-in user and renders the topbar user menu, with the
 * interface switch for the REGLO team. In the back office, the layout has
 * already checked the access with the API.
 */
export async function CurrentUserMenu({
    area = "app",
}: {
    area?: InterfaceKey;
}) {
    const user = await api.getCurrentUser();
    // The e-mail stands in for the name until accounts have one (US-01).
    const fullName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

    return (
        <div className="flex items-center gap-2">
            {(area === "admin" || user.platformAdmin) && (
                <InterfaceSwitch current={area} />
            )}
            <UserMenu
                fullName={fullName}
                roleLabel={
                    user.platformAdmin
                        ? PLATFORM_ROLE_LABEL
                        : ROLE_LABELS[user.role]
                }
                organizationName={user.organization?.name ?? null}
                avatar={user}
            />
        </div>
    );
}

export function CurrentUserMenuSkeleton() {
    return (
        <div aria-hidden="true">
            <Skeleton className="ml-2 size-8 rounded-full" />
        </div>
    );
}
