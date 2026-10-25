"use client";

import { Fragment, Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { DOMAIN_ICON_CLASSES } from "@/lib/domains";
import { getBreadcrumb } from "@/lib/navigation";

/** `[icon] Section / [icon] Page / Detail`, built from the current path. */
function AppBreadcrumbContent() {
    const crumbs = getBreadcrumb(usePathname());

    return (
        <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap">
                {crumbs.map((crumb, index) => {
                    const Icon = crumb.icon;
                    const isLast = index === crumbs.length - 1;
                    const content = (
                        <>
                            {Icon && (
                                <Icon
                                    aria-hidden="true"
                                    className={
                                        crumb.domain &&
                                        DOMAIN_ICON_CLASSES[crumb.domain]
                                    }
                                />
                            )}
                            <span className="truncate">{crumb.label}</span>
                        </>
                    );

                    return (
                        <Fragment key={crumb.href}>
                            {index > 0 && (
                                <BreadcrumbSeparator className="hidden sm:list-item" />
                            )}
                            <BreadcrumbItem
                                // On small screens only the current page is shown.
                                className={
                                    isLast ? "min-w-0" : "hidden sm:inline-flex"
                                }
                            >
                                {isLast ? (
                                    <BreadcrumbPage>{content}</BreadcrumbPage>
                                ) : (
                                    <BreadcrumbLink asChild>
                                        <Link href={crumb.href}>{content}</Link>
                                    </BreadcrumbLink>
                                )}
                            </BreadcrumbItem>
                        </Fragment>
                    );
                })}
            </BreadcrumbList>
        </Breadcrumb>
    );
}

/**
 * The current URL is read inside Suspense (pages with a dynamic id are
 * prerendered without breadcrumb, then it appears).
 */
export function AppBreadcrumb() {
    return (
        <Suspense fallback={<div className="min-w-0 flex-1" />}>
            <AppBreadcrumbContent />
        </Suspense>
    );
}
