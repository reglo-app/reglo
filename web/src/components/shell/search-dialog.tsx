"use client";

import { useEffect, useState } from "react";
import { Command, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Topbar search: a trigger that looks like a field and opens a search popup
 * near the top of the screen (also with Ctrl+K / Cmd+K). Results come with
 * the search feature; for now the popup only holds the field.
 */
export function SearchDialog() {
    const [open, setOpen] = useState(false);
    // Mac users see ⌘K, everyone else Ctrl K. Known only in the browser.
    const [isApple, setIsApple] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the browser
        setIsApple(
            /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
        );
    }, []);

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (
                event.key.toLowerCase() === "k" &&
                (event.ctrlKey || event.metaKey)
            ) {
                event.preventDefault();
                setOpen(true);
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="toolbar"
                    size="toolbar"
                    aria-label="Rechercher"
                    aria-keyshortcuts="Control+K Meta+K"
                    className="w-auto justify-start font-normal text-ink-muted md:w-64"
                >
                    <Search />
                    <span className="hidden md:inline">Rechercher…</span>
                    <kbd className="ml-auto hidden items-center gap-0.5 rounded-sm border border-border px-1.5 font-mono text-xs text-ink-muted md:inline-flex">
                        {isApple ? (
                            <>
                                <Command
                                    aria-label="Commande"
                                    className="size-3!"
                                />
                                K
                            </>
                        ) : (
                            "Ctrl K"
                        )}
                    </kbd>
                </Button>
            </DialogTrigger>
            <DialogContent
                showCloseButton={false}
                // Centred horizontally, slightly towards the top.
                className="top-[15vh] translate-y-0 gap-0 p-0 sm:max-w-xl data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 data-[state=open]:slide-in-from-top-2"
            >
                <DialogTitle className="sr-only">Rechercher</DialogTitle>
                <form
                    role="search"
                    className="relative border-b border-border"
                    onSubmit={(event) => event.preventDefault()}
                >
                    <Search
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted"
                    />
                    <input
                        type="search"
                        autoFocus
                        aria-label="Rechercher dans REGLO"
                        placeholder="Rechercher une action, un justificatif, une formation…"
                        className="h-14 w-full rounded-t-lg bg-transparent pr-4 pl-12 text-base text-ink outline-none placeholder:text-ink-muted"
                    />
                </form>
                <DialogDescription className="px-4 py-6 text-center">
                    La recherche sera bientôt disponible.
                </DialogDescription>
            </DialogContent>
        </Dialog>
    );
}
