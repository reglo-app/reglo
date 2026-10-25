import { Badge } from "@/components/ui/badge";
import { DOMAIN_ICON_CLASSES, DOMAINS, type DomainKey } from "@/lib/domains";
import { cn } from "@/lib/utils";

/** QHSE domain chip: tinted background, coloured domain icon and name. */
export function DomainBadge({
    domain,
    className,
}: {
    domain: DomainKey;
    className?: string;
}) {
    const Icon = DOMAINS[domain].icon;
    return (
        <Badge variant={domain} className={className}>
            <Icon
                aria-hidden="true"
                className={cn("size-3.5", DOMAIN_ICON_CLASSES[domain])}
            />
            {DOMAINS[domain].label}
        </Badge>
    );
}
