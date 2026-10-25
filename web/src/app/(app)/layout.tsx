import { Suspense } from "react";
import NextTopLoader from "nextjs-toploader";

import {
    CurrentUserMenu,
    CurrentUserMenuSkeleton,
} from "@/components/shell/current-user-menu";
import { AppShell } from "@/components/shell/app-shell";

export default function AppLayout({ children }: LayoutProps<"/">) {
    return (
        <>
            {/* Charter: thin 3px brand-green bar on every page change. */}
            <NextTopLoader
                color="var(--color-brand-green)"
                height={3}
                showSpinner={false}
                shadow={false}
            />
            <AppShell
                userMenu={
                    <Suspense fallback={<CurrentUserMenuSkeleton />}>
                        <CurrentUserMenu />
                    </Suspense>
                }
            >
                {children}
            </AppShell>
        </>
    );
}
