import {
    BadgeCheck,
    HardHat,
    HeartPulse,
    Leaf,
    type LucideIcon,
} from "lucide-react";

/** The four QHSE pillars. Technical keys are shared with the API. */
export const DOMAIN_KEYS = [
    "quality",
    "hygiene",
    "safety",
    "environment",
] as const;

export type DomainKey = (typeof DOMAIN_KEYS)[number];

export type Domain = {
    key: DomainKey;
    label: string;
    icon: LucideIcon;
};

export const DOMAINS: Record<DomainKey, Domain> = {
    quality: { key: "quality", label: "Qualité", icon: BadgeCheck },
    hygiene: { key: "hygiene", label: "Hygiène-Santé", icon: HeartPulse },
    safety: { key: "safety", label: "Sécurité", icon: HardHat },
    environment: { key: "environment", label: "Environnement", icon: Leaf },
};

/**
 * Icon colour of each domain: the whole icon is drawn in the domain colour.
 * Icons are decorative (the label is always next to them).
 */
export const DOMAIN_ICON_CLASSES: Record<DomainKey, string> = {
    quality: "text-quality",
    hygiene: "text-hygiene",
    safety: "text-safety",
    environment: "text-environment",
};

/** Solid fill in the domain colour (progress bars). */
export const DOMAIN_FILL_CLASSES: Record<DomainKey, string> = {
    quality: "bg-quality",
    hygiene: "bg-hygiene",
    safety: "bg-safety",
    environment: "bg-environment",
};

/** Light tint of the domain colour (panels, covers). */
export const DOMAIN_TINT_CLASSES: Record<DomainKey, string> = {
    quality: "bg-quality-50",
    hygiene: "bg-hygiene-50",
    safety: "bg-safety-50",
    environment: "bg-environment-50",
};

/** Stroke in the domain colour (score rings). */
export const DOMAIN_STROKE_CLASSES: Record<DomainKey, string> = {
    quality: "stroke-quality",
    hygiene: "stroke-hygiene",
    safety: "stroke-safety",
    environment: "stroke-environment",
};

export function isDomainKey(value: unknown): value is DomainKey {
    return (
        typeof value === "string" &&
        (DOMAIN_KEYS as readonly string[]).includes(value)
    );
}
