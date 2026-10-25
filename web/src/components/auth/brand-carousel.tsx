"use client";

import {
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
    type CSSProperties,
    type PointerEvent,
} from "react";
import Image from "next/image";
import { Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";

// Texts measured to wrap the same way: 2 lines of title (the first one
// almost full) and 2 full lines of description. Check again after a change.
const SLIDES = [
    {
        title: "Toute votre QHSE au même endroit",
        text: "Diagnostic, plan d'actions, justificatifs et formations : pilotez toute votre démarche depuis un seul outil.",
    },
    {
        title: "Sachez exactement où vous en êtes",
        text: "Un autodiagnostic guidé et un score par domaine pour identifier précisément vos actions prioritaires.",
    },
    {
        title: "Gardez toujours un temps d'avance",
        text: "Veille réglementaire et formations adaptées à votre activité : restez conforme sans y passer des heures.",
    },
] as const;

const INTERVAL_MS = 6000;
/** Horizontal distance (px) a swipe or drag needs to change slide. */
const SWIPE_THRESHOLD = 50;
/** While dragging, the text follows the pointer at half speed, up to this. */
const MAX_DRAG_OFFSET = 64;

type Direction = "next" | "previous";

type SlideState = {
    current: number;
    /** Slide that is leaving; null before the first change (no animation). */
    leaving: number | null;
    direction: Direction;
    /** Drag offset (px) kept on the leaving slide, so it leaves from there. */
    leavingOffset: number;
};

function subscribeReducedMotion(onChange: () => void) {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
}

function usePrefersReducedMotion() {
    return useSyncExternalStore(
        subscribeReducedMotion,
        () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        () => false,
    );
}

/**
 * Brand messages on the login page. Rotates on its own, stops while hovered
 * or focused, can be paused (WCAG 2.2.2) and does not rotate when the user
 * prefers reduced motion. A new slide comes in from the right, or from the
 * left when the user goes back with the bullets or swipes to the right.
 * Swipe (touch) and drag (mouse) change slide too; the bullets stay the
 * single-pointer alternative (WCAG 2.5.1).
 */
export function BrandCarousel() {
    const [{ current, leaving, direction, leavingOffset }, setSlides] =
        useState<SlideState>({
            current: 0,
            leaving: null,
            direction: "next",
            leavingOffset: 0,
        });
    const [paused, setPaused] = useState(false);
    const [interacting, setInteracting] = useState(false);
    /** Offset of the current slide while a pointer is down, else null. */
    const [dragOffset, setDragOffset] = useState<number | null>(null);
    const dragStart = useRef<{ pointerId: number; x: number } | null>(null);
    const reducedMotion = usePrefersReducedMotion();
    // A touch drag has no hover: stop the timer while the finger is down.
    const rotating =
        !paused && !interacting && !reducedMotion && dragOffset === null;
    const animated = leaving !== null && !reducedMotion;

    /** Bullet click: forward when the target is after the current slide. */
    function goTo(index: number) {
        setSlides((slides) =>
            index === slides.current
                ? slides
                : {
                      current: index,
                      leaving: slides.current,
                      direction: index > slides.current ? "next" : "previous",
                      leavingOffset: 0,
                  },
        );
    }

    /** Swipe: one step, looping at both ends like the automatic rotation. */
    function step(delta: 1 | -1, offset: number) {
        setSlides((slides) => ({
            current: (slides.current + delta + SLIDES.length) % SLIDES.length,
            leaving: slides.current,
            direction: delta === 1 ? "next" : "previous",
            leavingOffset: offset,
        }));
    }

    function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
        if (event.button !== 0) return;
        dragStart.current = { pointerId: event.pointerId, x: event.clientX };
        // Keeps receiving the moves when the pointer leaves the text.
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDragOffset(0);
    }

    function dragDistance(event: PointerEvent<HTMLDivElement>) {
        const start = dragStart.current;
        return start && start.pointerId === event.pointerId
            ? event.clientX - start.x
            : null;
    }

    function followPointer(distance: number) {
        if (reducedMotion) return 0;
        return Math.max(
            -MAX_DRAG_OFFSET,
            Math.min(MAX_DRAG_OFFSET, distance / 2),
        );
    }

    function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
        const distance = dragDistance(event);
        if (distance !== null) setDragOffset(followPointer(distance));
    }

    function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
        const distance = dragDistance(event);
        dragStart.current = null;
        setDragOffset(null);
        if (distance === null || Math.abs(distance) < SWIPE_THRESHOLD) return;
        // Content moves with the finger: dragging left shows the next slide.
        step(distance < 0 ? 1 : -1, followPointer(distance));
    }

    function cancelDrag() {
        dragStart.current = null;
        setDragOffset(null);
    }

    // `translate` adds up with the enter/exit animations (they use
    // `transform`), so a slide leaves from where the drag left it.
    function offsetStyle(
        active: boolean,
        isLeaving: boolean,
    ): CSSProperties | undefined {
        if (active) {
            return dragOffset === null
                ? { transition: "translate 200ms ease-out" } // snaps back
                : { translate: `${dragOffset}px 0` };
        }
        if (isLeaving && leavingOffset !== 0) {
            return { translate: `${leavingOffset}px 0` };
        }
        return undefined;
    }

    useEffect(() => {
        if (!rotating) return;
        const id = window.setInterval(
            () =>
                setSlides((slides) => ({
                    current: (slides.current + 1) % SLIDES.length,
                    leaving: slides.current,
                    direction: "next",
                    leavingOffset: 0,
                })),
            INTERVAL_MS,
        );
        return () => window.clearInterval(id);
    }, [rotating]);

    return (
        <section
            aria-roledescription="carrousel"
            aria-label="Présentation de REGLO"
            className="flex w-full max-w-md flex-col items-center text-center"
            onMouseEnter={() => setInteracting(true)}
            onMouseLeave={() => setInteracting(false)}
            onFocus={() => setInteracting(true)}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setInteracting(false);
                }
            }}
        >
            <div className="glass mb-10 flex size-24 items-center justify-center rounded-2xl">
                <Image
                    src="/brand/reglo-symbol.png"
                    alt="REGLO"
                    width={56}
                    height={43}
                    priority
                    className="relative"
                />
            </div>

            {/* Slides are stacked in one grid cell: the height is the tallest
                slide's, and shorter ones are centred vertically in it.
                Text sizes follow the width (container units), so lines break
                at the same words on every screen: 30px / 18px at 448px. */}
            {/* touch-pan-y: vertical scrolling stays with the browser, the
                horizontal gesture is ours. */}
            <div
                className="@container grid w-full cursor-grab touch-pan-y overflow-hidden select-none active:cursor-grabbing"
                aria-live={rotating ? "off" : "polite"}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={cancelDrag}
            >
                {SLIDES.map((slide, index) => {
                    const active = index === current;
                    const isLeaving = animated && index === leaving;
                    const forward = direction === "next";
                    return (
                        <div
                            key={slide.title}
                            role="group"
                            aria-roledescription="diapositive"
                            aria-label={`${index + 1} sur ${SLIDES.length}`}
                            aria-hidden={!active}
                            inert={!active}
                            data-enter={
                                active && animated
                                    ? forward
                                        ? "from-right"
                                        : "from-left"
                                    : undefined
                            }
                            style={offsetStyle(active, isLeaving)}
                            className={cn(
                                "col-start-1 row-start-1 flex flex-col justify-center",
                                // The old slide leaves first, then the new one
                                // comes in: the texts never overlap.
                                active && "opacity-100",
                                active &&
                                    animated &&
                                    "animate-in delay-200 duration-500 ease-out fade-in fill-mode-both",
                                active &&
                                    animated &&
                                    (forward
                                        ? "slide-in-from-right-10"
                                        : "slide-in-from-left-10"),
                                isLeaving &&
                                    "pointer-events-none animate-out opacity-100 duration-200 ease-in fade-out fill-mode-forwards",
                                isLeaving &&
                                    (forward
                                        ? "slide-out-to-left-10"
                                        : "slide-out-to-right-10"),
                                !active &&
                                    !isLeaving &&
                                    "pointer-events-none opacity-0",
                            )}
                        >
                            <p className="font-display text-[length:calc(100cqi*30/448)] leading-tight font-extrabold tracking-wide text-white uppercase">
                                {slide.title}
                            </p>
                            <p className="mt-4 text-[length:calc(100cqi*18/448)] leading-[calc(28/18)] font-light text-white/80">
                                {slide.text}
                            </p>
                        </div>
                    );
                })}
            </div>

            <div className="relative mt-7.5 flex items-center">
                {SLIDES.map((slide, index) => (
                    <button
                        key={slide.title}
                        type="button"
                        onClick={() => goTo(index)}
                        aria-label={`Afficher le message ${index + 1} sur ${SLIDES.length}`}
                        aria-current={index === current || undefined}
                        // The button follows the indicator width plus the same
                        // padding, so the visible gaps stay equal whether the
                        // bar is first, in the middle or last. Hit area: 24px.
                        className="group flex h-6 items-center justify-center rounded-full px-1.25"
                    >
                        <span
                            className={cn(
                                "block h-2 rounded-full transition-all duration-300",
                                index === current
                                    ? "w-6 bg-white"
                                    : "w-2 bg-white/40 group-hover:bg-white/70",
                            )}
                        />
                    </button>
                ))}
                {/* Pause control (WCAG 2.2.2 / RGAA 13.8): hidden for the mouse,
                    which already pauses the carousel on hover; it appears on
                    keyboard focus and stays available to screen readers. */}
                {!reducedMotion && (
                    <button
                        type="button"
                        onClick={() => setPaused((value) => !value)}
                        aria-label={
                            paused
                                ? "Reprendre le défilement"
                                : "Mettre en pause le défilement"
                        }
                        className="pointer-events-none absolute left-full ml-1 flex size-6 items-center justify-center rounded-full text-white/80 opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100"
                    >
                        {paused ? (
                            <Play aria-hidden="true" className="size-3.5" />
                        ) : (
                            <Pause aria-hidden="true" className="size-3.5" />
                        )}
                    </button>
                )}
            </div>
        </section>
    );
}
