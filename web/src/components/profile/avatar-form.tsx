"use client";

import { startTransition, useActionState, useRef } from "react";
import {
    Camera,
    CircleAlert,
    ImageUp,
    LoaderCircle,
    Trash2,
} from "lucide-react";

import { UserAvatar } from "@/components/profile/user-avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CurrentUser } from "@/lib/api";
import {
    removeAvatar,
    uploadAvatar,
    type AvatarState,
} from "@/lib/profile/actions";
import { AVATAR_TYPES, prepareAvatar } from "@/lib/profile/avatar";

export type AvatarFormProps = {
    user: Pick<CurrentUser, "id" | "avatarVersion">;
    fullName: string;
    /** Shown next to the photo (name, job title...). */
    children?: React.ReactNode;
    /** Injected in tests; the server actions by default. */
    upload?: typeof uploadAvatar;
    remove?: typeof removeAvatar;
};

const CAMERA_BUTTON =
    "absolute right-0 bottom-0 flex size-9 items-center justify-center rounded-full border-2 border-white bg-brand-teal text-white shadow-overlay transition-colors hover:bg-teal-700 disabled:opacity-70 [&_svg]:size-4";

/**
 * Profile photo of the settings header. Choosing a file sends it at once:
 * the browser reduces it first, the API crops it to a square and removes
 * its metadata.
 */
export function AvatarForm({
    user,
    fullName,
    children,
    upload = uploadAvatar,
    remove = removeAvatar,
}: AvatarFormProps) {
    const [uploadState, uploadAction, isUploading] = useActionState<
        AvatarState,
        File
    >(async (previous, file) => {
        const prepared = await prepareAvatar(file);
        if ("error" in prepared) {
            return { error: prepared.error };
        }
        const formData = new FormData();
        formData.set("file", prepared.file);
        return upload(previous, formData);
    }, {});
    const [removeState, removeAction, isRemoving] = useActionState<
        AvatarState,
        void
    >(() => remove(), {});
    const inputRef = useRef<HTMLInputElement>(null);
    const isBusy = isUploading || isRemoving;
    const error = uploadState.error ?? removeState.error;
    const hasPhoto = Boolean(user.avatarVersion);

    function chooseFile() {
        inputRef.current?.click();
    }

    function sendFile(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        // Lets the user choose the same file again after an error.
        event.target.value = "";
        if (file) {
            startTransition(() => uploadAction(file));
        }
    }

    const cameraIcon = isBusy ? (
        <LoaderCircle aria-hidden="true" className="animate-spin" />
    ) : (
        <Camera aria-hidden="true" />
    );

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
                {/* Overlaps the banner above it. */}
                <div className="relative -mt-12 w-fit shrink-0 sm:-mt-8">
                    <UserAvatar
                        user={user}
                        fullName={fullName}
                        size="xl"
                        className="ring-4 ring-white"
                    />
                    <input
                        ref={inputRef}
                        type="file"
                        accept={AVATAR_TYPES.join(",")}
                        className="sr-only"
                        tabIndex={-1}
                        aria-hidden="true"
                        onChange={sendFile}
                    />
                    {hasPhoto ? (
                        <DropdownMenu modal={false}>
                            <DropdownMenuTrigger
                                className={CAMERA_BUTTON}
                                disabled={isBusy}
                                aria-label="Modifier la photo de profil"
                            >
                                {cameraIcon}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-52">
                                <DropdownMenuItem onSelect={chooseFile}>
                                    <ImageUp aria-hidden="true" />
                                    Changer la photo
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onSelect={() =>
                                        startTransition(() => removeAction())
                                    }
                                >
                                    <Trash2 aria-hidden="true" />
                                    Supprimer la photo
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <button
                            type="button"
                            className={CAMERA_BUTTON}
                            disabled={isBusy}
                            aria-label="Ajouter une photo de profil"
                            onClick={chooseFile}
                        >
                            {cameraIcon}
                        </button>
                    )}
                </div>
                {children}
            </div>

            {/* Announced: the photo changes without moving the focus. */}
            <p className="sr-only" role="status">
                {isUploading
                    ? "Envoi de la photo…"
                    : isRemoving
                      ? "Suppression de la photo…"
                      : ""}
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
