"use client";

import { useActionState, useRef } from "react";
import { Camera, CircleAlert, LoaderCircle, Trash2 } from "lucide-react";

import { UserAvatar } from "@/components/profile/user-avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/lib/api";
import {
    removeAvatar,
    uploadAvatar,
    type AvatarState,
} from "@/lib/profile/actions";
import { AVATAR_TYPES } from "@/lib/profile/avatar";

export type AvatarFormProps = {
    user: Pick<CurrentUser, "id" | "avatarVersion">;
    fullName: string;
    /** Injected in tests; the server actions by default. */
    upload?: typeof uploadAvatar;
    remove?: typeof removeAvatar;
};

/**
 * Profile photo: choosing a file sends it at once. The API crops it to a
 * square and removes its metadata.
 */
export function AvatarForm({
    user,
    fullName,
    upload = uploadAvatar,
    remove = removeAvatar,
}: AvatarFormProps) {
    const [uploadState, uploadAction, isUploading] = useActionState<
        AvatarState,
        FormData
    >(upload, {});
    const [removeState, removeAction, isRemoving] = useActionState<
        AvatarState,
        FormData
    >(() => remove(), {});
    const formRef = useRef<HTMLFormElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const isBusy = isUploading || isRemoving;
    const error = uploadState.error ?? removeState.error;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
                <UserAvatar user={user} fullName={fullName} size="lg" />

                <form ref={formRef} action={uploadAction}>
                    {/* The visible button opens the file picker. */}
                    <input
                        ref={inputRef}
                        type="file"
                        name="file"
                        accept={AVATAR_TYPES.join(",")}
                        className="sr-only"
                        tabIndex={-1}
                        aria-hidden="true"
                        onChange={() => formRef.current?.requestSubmit()}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => inputRef.current?.click()}
                    >
                        {isUploading ? (
                            <LoaderCircle
                                aria-hidden="true"
                                className="animate-spin"
                            />
                        ) : (
                            <Camera aria-hidden="true" />
                        )}
                        {isUploading
                            ? "Envoi…"
                            : user.avatarVersion
                              ? "Changer la photo"
                              : "Ajouter une photo"}
                    </Button>
                </form>

                {user.avatarVersion && (
                    <form action={removeAction}>
                        <Button type="submit" variant="ghost" disabled={isBusy}>
                            <Trash2 aria-hidden="true" />
                            {isRemoving ? "Suppression…" : "Supprimer"}
                        </Button>
                    </form>
                )}
            </div>

            <p className="text-sm text-ink-muted">
                JPEG, PNG ou WebP, 5 Mo maximum. La photo est recadrée en carré.
            </p>

            {error && (
                <Alert variant="destructive">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}
