"use client";

import { useEffect, useState } from "react";
import { Bell, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { AppBreadcrumb } from "@/components/shell/app-breadcrumb";
import { SearchDialog } from "@/components/shell/search-dialog";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const COLLAPSED_KEY = "reglo.sidebar.collapsed";

type AppShellProps = {
    /** User menu slot, rendered by the layout (it loads the current user). */
    userMenu: React.ReactNode;
    children: React.ReactNode;
};

export function AppShell({ userMenu, children }: AppShellProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    // Restore the desktop sidebar state (per-browser preference).
    useEffect(() => {
        try {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from browser storage
            setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "true");
        } catch {
            // Storage unavailable: keep the default.
        }
    }, []);

    function toggleCollapsed() {
        const next = !collapsed;
        setCollapsed(next);
        try {
            localStorage.setItem(COLLAPSED_KEY, String(next));
        } catch {
            // Storage unavailable: the state only lasts for this page.
        }
    }

    return (
        <div className="flex min-h-screen w-full">
            <a
                href="#main-content"
                className="sr-only z-50 rounded-md bg-brand-teal px-4 py-3 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
            >
                Aller au contenu
            </a>

            {/* Desktop sidebar */}
            <aside
                id="app-sidebar"
                className={cn(
                    "sticky top-0 hidden h-screen shrink-0 border-r border-border bg-white transition-[width] duration-200 lg:block",
                    collapsed ? "w-20" : "w-64",
                )}
            >
                <SidebarNav collapsed={collapsed} />
            </aside>

            {/* Mobile drawer */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetContent side="left" className="w-72 p-0">
                    <SheetTitle className="sr-only">Menu</SheetTitle>
                    <SheetDescription className="sr-only">
                        Navigation principale de REGLO
                    </SheetDescription>
                    <SidebarNav onNavigate={() => setMobileOpen(false)} />
                </SheetContent>
            </Sheet>

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border bg-surface-subtle px-4 sm:px-6">
                    <Button
                        variant="toolbar"
                        size="toolbar-icon"
                        className="lg:hidden"
                        aria-label="Ouvrir le menu"
                        aria-expanded={mobileOpen}
                        onClick={() => setMobileOpen(true)}
                    >
                        <PanelLeftOpen />
                    </Button>
                    <Button
                        variant="toolbar"
                        size="toolbar-icon"
                        className="hidden lg:inline-flex"
                        aria-label={
                            collapsed ? "Déplier le menu" : "Replier le menu"
                        }
                        aria-controls="app-sidebar"
                        aria-expanded={!collapsed}
                        onClick={toggleCollapsed}
                    >
                        {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                    </Button>

                    <AppBreadcrumb />

                    <div className="ml-auto flex items-center gap-1 sm:gap-2">
                        <SearchDialog />
                        <Button
                            variant="toolbar"
                            size="toolbar-icon"
                            aria-label="Notifications"
                        >
                            <Bell />
                        </Button>
                        {userMenu}
                    </div>
                </header>

                <main
                    id="main-content"
                    tabIndex={-1}
                    // Uses the full width next to the sidebar, folded or not.
                    className="w-full flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8"
                >
                    {children}
                </main>
            </div>
        </div>
    );
}
