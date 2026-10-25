import {
    FileCheck,
    GraduationCap,
    LayoutDashboard,
    Settings,
    type LucideIcon,
} from "lucide-react";

import { DOMAIN_KEYS, DOMAINS, type DomainKey } from "@/lib/domains";

/** A sub-page of a nav item: shown under its parent, without icon. */
export type NavChild = {
    href: string;
    label: string;
    /** Breadcrumb label of its detail pages (e.g. `/news/{id}`). */
    detailLabel?: string;
};

export type NavItem = {
    href: string;
    label: string;
    icon: LucideIcon;
    /** QHSE domain of the page, shown with its colour in the sidebar. */
    domain?: DomainKey;
    /** Sub-pages, visible in the sidebar only inside this branch. */
    children?: NavChild[];
};

export const HOME_ITEM: NavItem = {
    href: "/dashboard",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    children: [
        { href: "/diagnostic", label: "Diagnostic" },
        { href: "/actions", label: "Plan d'actions" },
        {
            href: "/news",
            label: "Veille réglementaire",
            detailLabel: "Article",
        },
    ],
};

export type NavSection = {
    /** Small title above the section; none for the first one. */
    title?: string;
    items: NavItem[];
};

/** Sidebar sections, in order (Paramètres is pinned at the bottom). */
export const NAV_SECTIONS: NavSection[] = [
    {
        items: [
            HOME_ITEM,
            { href: "/documents", label: "Justificatifs", icon: FileCheck },
            { href: "/trainings", label: "Formations", icon: GraduationCap },
        ],
    },
    {
        title: "Domaines QHSE",
        items: DOMAIN_KEYS.map((key) => ({
            href: `/domains/${key}`,
            label: DOMAINS[key].label,
            icon: DOMAINS[key].icon,
            domain: key,
        })),
    },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export const SETTINGS_ITEM: NavItem = {
    href: "/settings",
    label: "Paramètres",
    icon: Settings,
};

type Entry = NavChild & { item: NavItem; isChild: boolean };

const ALL_ENTRIES: Entry[] = [...NAV_ITEMS, SETTINGS_ITEM].flatMap((item) => [
    { href: item.href, label: item.label, item, isChild: false },
    ...(item.children ?? []).map((child) => ({
        ...child,
        item,
        isChild: true,
    })),
]);

/** True when `pathname` is the page or one of its sub-pages. */
export function isActive(entry: { href: string }, pathname: string): boolean {
    return pathname === entry.href || pathname.startsWith(`${entry.href}/`);
}

/**
 * Nav entry (item or child) of the current page. The most specific match
 * wins, so `/actions/42` is "Plan d'actions".
 */
export function findNavEntry(pathname: string): Entry | undefined {
    return ALL_ENTRIES.filter((entry) => isActive(entry, pathname)).sort(
        (a, b) => b.href.length - a.href.length,
    )[0];
}

/** The top-level item whose branch holds the current page. */
export function findNavItem(pathname: string): NavItem | undefined {
    return findNavEntry(pathname)?.item;
}

export type Crumb = {
    label: string;
    href: string;
    icon?: LucideIcon;
    domain?: DomainKey;
};

/**
 * Breadcrumb for a path: the top-level section, the sub-page if any, then
 * a detail segment. "Tableau de bord" only appears in its own branch
 * (e.g. Tableau de bord / Diagnostic), not before Justificatifs or Qualité.
 * The last crumb is the current page.
 */
export function getBreadcrumb(pathname: string): Crumb[] {
    const entry = findNavEntry(pathname);
    if (!entry) {
        return [HOME_ITEM];
    }

    const crumbs: Crumb[] = [entry.item];
    if (entry.isChild) {
        crumbs.push({ label: entry.label, href: entry.href });
    }

    if (pathname !== entry.href) {
        const detail = pathname.slice(entry.href.length + 1).split("/")[0];
        crumbs.push({
            label: entry.detailLabel ?? decodeURIComponent(detail),
            href: `${entry.href}/${detail}`,
        });
    }

    return crumbs;
}
