import type { CurrentUser, EvidenceDocument } from "@/lib/api/types";

/** Same limit as DocumentStorage in the API, which has the last word. */
export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;

/** Type found by the API (or the extension) -> word shown to users. */
const FORMATS = [
    { extensions: ["pdf"], mimeType: "application/pdf", label: "PDF" },
    { extensions: ["png"], mimeType: "image/png", label: "PNG" },
    { extensions: ["jpg", "jpeg"], mimeType: "image/jpeg", label: "JPEG" },
    {
        extensions: ["xlsx"],
        mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        label: "XLSX",
    },
    { extensions: ["csv"], mimeType: "text/csv", label: "CSV" },
];

/** For the file picker: only a first filter, drag and drop skips it. */
export const DOCUMENT_ACCEPT = FORMATS.flatMap((format) =>
    format.extensions.map((extension) => `.${extension}`),
).join(",");

export const DOCUMENT_MESSAGES = {
    tooLarge: "Ce fichier dépasse la taille maximale de 20 Mo.",
    invalidType:
        "Ce format n'est pas accepté. Déposez un PDF, une image (PNG, JPEG) ou un tableur (XLSX, CSV).",
    empty: "Ce fichier est vide.",
    network:
        "La connexion a été interrompue pendant le dépôt. Vérifiez votre réseau et réessayez.",
    unavailable:
        "Le dépôt est impossible pour le moment. Réessayez dans un instant.",
};

/**
 * What can be said before sending anything: saves a long wait. The content
 * of the file is checked by the API.
 */
export function checkDocumentFile(file: {
    name: string;
    size: number;
}): string | null {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const accepted =
        file.name.includes(".") &&
        FORMATS.some((format) => format.extensions.includes(extension));

    if (!accepted) return DOCUMENT_MESSAGES.invalidType;
    if (file.size > DOCUMENT_MAX_BYTES) return DOCUMENT_MESSAGES.tooLarge;
    if (file.size === 0) return DOCUMENT_MESSAGES.empty;
    return null;
}

/** A larger table is not read in the browser: it is downloaded. */
export const CSV_PREVIEW_MAX_BYTES = 2 * 1024 * 1024;

/** How the app can show a document; null: it can only be downloaded. */
export function previewKind(mimeType: string): "pdf" | "image" | "csv" | null {
    if (mimeType === "application/pdf") return "pdf";
    if (mimeType === "image/png" || mimeType === "image/jpeg") return "image";
    if (mimeType === "text/csv") return "csv";
    return null;
}

/** "PDF", from the type found by the API. */
export function formatLabel(mimeType: string): string {
    return (
        FORMATS.find((format) => format.mimeType === mimeType)?.label ??
        "Fichier"
    );
}

const sizeFormatter = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
});

/** "830 o", "47,2 ko", "2,3 Mo". */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${sizeFormatter.format(bytes / 1024)} ko`;
    return `${sizeFormatter.format(bytes / (1024 * 1024))} Mo`;
}

/** Same rule as the API: its author or an administrator, never a reader. */
export function canDeleteDocument(
    document: EvidenceDocument,
    user: CurrentUser,
): boolean {
    return (
        user.role === "admin" ||
        (user.role === "member" && document.uploadedBy?.id === user.id)
    );
}
