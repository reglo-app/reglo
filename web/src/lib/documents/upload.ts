import { DOCUMENT_MESSAGES } from "./documents";

export type UploadResult =
    { ok: true } | { error: string; sessionExpired?: boolean };

/**
 * Sends a file to app/document-files/route.ts. With XMLHttpRequest: fetch
 * cannot tell how much of a file has been sent. Messages are shown as is.
 */
export function uploadDocument(
    file: File,
    domain: string,
    onProgress: (percent: number) => void,
): Promise<UploadResult> {
    const body = new FormData();
    body.set("domain", domain);
    body.set("file", file);

    return new Promise((resolve) => {
        const request = new XMLHttpRequest();
        request.open("POST", "/document-files");
        request.responseType = "json";

        request.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                onProgress(Math.round((event.loaded / event.total) * 100));
            }
        };
        request.onerror = () => resolve({ error: DOCUMENT_MESSAGES.network });
        request.onabort = () => resolve({ error: DOCUMENT_MESSAGES.network });
        request.onload = () => {
            if (request.status === 201) {
                resolve({ ok: true });
                return;
            }
            const error: unknown = request.response?.error;
            resolve({
                error:
                    typeof error === "string"
                        ? error
                        : DOCUMENT_MESSAGES.unavailable,
                sessionExpired: request.status === 401,
            });
        };

        request.send(body);
    });
}
