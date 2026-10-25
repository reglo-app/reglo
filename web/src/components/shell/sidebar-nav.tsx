"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { DOMAIN_ICON_CLASSES } from "@/lib/domains";
import {
    HOME_ITEM,
    NAV_SECTIONS,
    SETTINGS_ITEM,
    findNavEntry,
    type NavItem,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

type SidebarNavProps = {
    /** Icons only (desktop collapsed sidebar). */
    collapsed?: boolean;
    /** Called after a link is clicked (closes the mobile drawer). */
    onNavigate?: () => void;
};

/**
 * One top-level entry and, inside its branch, its sub-pages. Sub-pages have
 * no icon and their text lines up with the parent's text.
 */
function NavBranch({
    item,
    collapsed,
    onNavigate,
    pathname,
}: {
    item: NavItem;
    collapsed: boolean;
    onNavigate?: () => void;
    /** null while the URL is not known yet (nothing highlighted). */
    pathname: string | null;
}) {
    const entry = pathname === null ? undefined : findNavEntry(pathname);
    const inBranch = entry?.item.href === item.href;
    const current = inBranch && !entry.isChild;
    // Parent of the current sub-page: emphasised, without the active fill.
    // In the folded sidebar there are no sub-pages, so it keeps the fill.
    const parentOfCurrent = inBranch && entry.isChild;
    const filled = current || (parentOfCurrent && collapsed);
    const Icon = item.icon;

    return (
        <li>
            <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={current ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                    "flex min-h-10 items-center gap-3 rounded-md px-3 text-base font-medium transition-colors",
                    filled
                        ? "bg-green-50 text-ink"
                        : "text-ink-muted hover:bg-surface-subtle hover:text-ink",
                    parentOfCurrent && "font-semibold text-ink",
                    collapsed && "justify-center px-0",
                )}
            >
                <Icon
                    aria-hidden="true"
                    className={cn(
                        "size-5 shrink-0",
                        // QHSE pillars keep their colour; other icons follow the state.
                        item.domain
                            ? DOMAIN_ICON_CLASSES[item.domain]
                            : inBranch
                              ? "text-green-700"
                              : "text-ink-muted",
                    )}
                />
                <span className={cn(collapsed && "sr-only")}>{item.label}</span>
            </Link>

            {item.children && !collapsed && (
                // Always rendered so it can open and close smoothly (height
                // via grid rows + opacity, 180 ms). Closed, it is inert:
                // out of the tab order and hidden from screen readers.
                <div
                    inert={!inBranch}
                    aria-hidden={!inBranch}
                    className={cn(
                        "grid transition-[grid-template-rows,opacity] duration-180 ease-out motion-reduce:transition-none",
                        inBranch
                            ? "grid-rows-[1fr] opacity-100"
                            : "grid-rows-[0fr] opacity-0",
                    )}
                >
                    <div className="min-h-0 overflow-hidden">
                        {/* Thin line from under the parent icon (its centre
                            is 12px padding + 10px = 22px from the left),
                            along the sub-pages, slightly shorter than the list. */}
                        <ul className="relative mt-1 ml-[21px] flex flex-col gap-1 pl-[5px] before:absolute before:top-0.5 before:bottom-1.5 before:left-0 before:w-px before:bg-border">
                            {item.children.map((child) => {
                                const childCurrent = entry?.href === child.href;
                                return (
                                    <li key={child.href}>
                                        <Link
                                            href={child.href}
                                            onClick={onNavigate}
                                            aria-current={
                                                childCurrent
                                                    ? "page"
                                                    : undefined
                                            }
                                            // Text lines up with the parent's text at 44px:
                                            // 21px margin + 1px line + 4px + 18px.
                                            className={cn(
                                                "flex min-h-9 items-center rounded-md pr-3 pl-[18px] text-sm font-medium transition-colors",
                                                childCurrent
                                                    ? "bg-green-50 text-ink"
                                                    : "text-ink-muted hover:bg-surface-subtle hover:text-ink",
                                            )}
                                        >
                                            {child.label}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
            )}
        </li>
    );
}

function SidebarNavView({
    collapsed = false,
    onNavigate,
    pathname,
}: SidebarNavProps & { pathname: string | null }) {
    return (
        <div className="flex h-full flex-col gap-4 py-4">
            <Link
                href={HOME_ITEM.href}
                onClick={onNavigate}
                className={cn(
                    "mx-3 flex min-h-10 items-center gap-2 rounded-md px-2",
                    collapsed && "justify-center px-0",
                )}
            >
                <Image
                    src="/brand/reglo-symbol.png"
                    alt=""
                    width={36}
                    height={28}
                    priority
                />
                {/* Text wordmark until the full logo is delivered. */}
                <span
                    className={cn(
                        "font-display text-2xl font-extrabold text-brand-teal",
                        collapsed && "sr-only",
                    )}
                >
                    REGLO
                </span>
            </Link>

            <nav
                aria-label="Navigation principale"
                className="flex min-h-0 flex-1 flex-col"
            >
                {/* Only the sections scroll; Paramètres stays at the bottom. */}
                <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3">
                    {NAV_SECTIONS.map((section, index) => (
                        <div key={section.title ?? index}>
                            {section.title && (
                                <p
                                    className={cn(
                                        "px-3 pb-1.5 text-xs font-medium tracking-wide text-ink-muted uppercase",
                                        collapsed && "sr-only",
                                    )}
                                >
                                    {section.title}
                                </p>
                            )}
                            <ul className="flex flex-col gap-1">
                                {section.items.map((item) => (
                                    <NavBranch
                                        key={item.href}
                                        item={item}
                                        collapsed={collapsed}
                                        onNavigate={onNavigate}
                                        pathname={pathname}
                                    />
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <ul className="mx-3 mt-2 flex flex-col gap-1 border-t border-border pt-2">
                    <NavBranch
                        item={SETTINGS_ITEM}
                        collapsed={collapsed}
                        onNavigate={onNavigate}
                        pathname={pathname}
                    />
                </ul>
            </nav>
        </div>
    );
}

function SidebarNavWithPathname(props: SidebarNavProps) {
    return <SidebarNavView {...props} pathname={usePathname()} />;
}

/**
 * The current URL is read inside Suspense: pages with a dynamic id
 * (e.g. /news/[id]) are prerendered with the fallback, then highlighted.
 */
export function SidebarNav(props: SidebarNavProps) {
    return (
        <Suspense fallback={<SidebarNavView {...props} pathname={null} />}>
            <SidebarNavWithPathname {...props} />
        </Suspense>
    );
}
