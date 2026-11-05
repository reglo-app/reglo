"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { DOMAIN_KEYS, DOMAINS } from "@/lib/domains";
import { checkDocumentFile, DOCUMENT_ACCEPT } from "@/lib/documents/documents";
import { uploadDocument } from "@/lib/documents/upload";
import { cn } from "@/lib/utils";

/**
 * Upload of a document (US-11): a button, or drag and drop. The button is
 * enough with a keyboard or a screen reader.
 */
export function DocumentUploader({
    upload = uploadDocument,
}: {
    /** Injected in tests; XMLHttpRequest to the web server by default. */
    upload?: typeof uploadDocument;
}) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const [domain, setDomain] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState<{
        name: string;
        percent: number;
    } | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function send(file: File) {
        if (uploading) return;

        const refusal = checkDocumentFile(file);
        setError(refusal);
        if (refusal) return;

        setUploading({ name: file.name, percent: 0 });
        const result = await upload(file, domain, (percent) =>
            setUploading({ name: file.name, percent }),
        );
        setUploading(null);

        if ("ok" in result) {
            toast.success(`« ${file.name} » est déposé.`);
            router.refresh();
        } else if (result.sessionExpired) {
            router.push("/session-expired");
        } else {
            setError(result.error);
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex max-w-sm flex-col gap-1.5">
                <label
                    htmlFor="document-domain"
                    className="text-base font-medium"
                >
                    Domaine (facultatif)
                </label>
                <NativeSelect
                    id="document-domain"
                    value={domain}
                    disabled={uploading !== null}
                    onChange={(event) => setDomain(event.target.value)}
                >
                    <option value="">Aucun domaine</option>
                    {DOMAIN_KEYS.map((key) => (
                        <option key={key} value={key}>
                            {DOMAINS[key].label}
                        </option>
                    ))}
                </NativeSelect>
            </div>

            <div
                data-testid="document-dropzone"
                onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    const file = event.dataTransfer.files[0];
                    if (file) void send(file);
                }}
                className={cn(
                    "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-border-strong px-4 py-8 text-center transition-colors",
                    isDragging && "border-green-600 bg-green-50",
                )}
            >
                <UploadCloud
                    aria-hidden="true"
                    className="size-8 text-green-700"
                />
                {uploading ? (
                    <div className="flex w-full max-w-md flex-col gap-2">
                        <p className="break-words">
                            Dépôt de « {uploading.name} »…
                        </p>
                        <div
                            role="progressbar"
                            aria-label={`Dépôt de ${uploading.name}`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={uploading.percent}
                            className="h-2 overflow-hidden rounded-full bg-surface-subtle"
                        >
                            <div
                                className="h-full rounded-full bg-green-700 transition-[width]"
                                style={{ width: `${uploading.percent}%` }}
                            />
                        </div>
                        <p className="text-sm text-ink-muted">
                            {uploading.percent} %
                        </p>
                    </div>
                ) : (
                    <>
                        <p>
                            Glissez un fichier ici, ou choisissez-le sur votre
                            appareil.
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => inputRef.current?.click()}
                        >
                            Choisir un fichier
                        </Button>
                        <p className="text-sm text-ink-muted">
                            PDF, PNG, JPEG, XLSX ou CSV, 20 Mo maximum.
                        </p>
                    </>
                )}
                <input
                    ref={inputRef}
                    type="file"
                    hidden
                    aria-label="Fichier à déposer"
                    accept={DOCUMENT_ACCEPT}
                    onChange={(event) => {
                        const file = event.target.files?.[0];
                        // The same file can be chosen again after a failure.
                        event.target.value = "";
                        if (file) void send(file);
                    }}
                />
            </div>

            {error && (
                <Alert variant="destructive">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
