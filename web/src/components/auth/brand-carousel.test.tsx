import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BrandCarousel } from "./brand-carousel";

function mockReducedMotion(reduce: boolean) {
    vi.stubGlobal(
        "matchMedia",
        vi.fn().mockReturnValue({
            matches: reduce,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }),
    );
}

const visibleSlide = () =>
    screen
        .getAllByRole("group", { hidden: true })
        .find((slide) => slide.getAttribute("aria-hidden") === "false");

describe("BrandCarousel", () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        mockReducedMotion(false);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("moves to the next message on its own", () => {
        render(<BrandCarousel />);
        expect(visibleSlide()).toHaveAccessibleName("1 sur 3");

        act(() => vi.advanceTimersByTime(6000));
        expect(visibleSlide()).toHaveAccessibleName("2 sur 3");
    });

    it("shows the message of the clicked bullet", async () => {
        render(<BrandCarousel />);
        await userEvent.click(
            screen.getByRole("button", { name: "Afficher le message 3 sur 3" }),
        );
        expect(visibleSlide()).toHaveAccessibleName("3 sur 3");
    });

    it("brings the new message from the right, or from the left when going back", async () => {
        render(<BrandCarousel />);
        await userEvent.click(
            screen.getByRole("button", { name: "Afficher le message 3 sur 3" }),
        );
        expect(visibleSlide()).toHaveAttribute("data-enter", "from-right");

        await userEvent.click(
            screen.getByRole("button", { name: "Afficher le message 1 sur 3" }),
        );
        expect(visibleSlide()).toHaveAttribute("data-enter", "from-left");
    });

    describe("swipe and drag", () => {
        function drag(from: number, to: number) {
            const area = visibleSlide()!.parentElement!;
            fireEvent.pointerDown(area, {
                pointerId: 1,
                button: 0,
                clientX: from,
            });
            fireEvent.pointerMove(area, { pointerId: 1, clientX: to });
            fireEvent.pointerUp(area, { pointerId: 1, clientX: to });
        }

        it("goes to the next message when dragged to the left", () => {
            render(<BrandCarousel />);
            drag(300, 200);
            expect(visibleSlide()).toHaveAccessibleName("2 sur 3");
            expect(visibleSlide()).toHaveAttribute("data-enter", "from-right");
        });

        it("goes back, looping to the last message, when dragged to the right", () => {
            render(<BrandCarousel />);
            drag(200, 300);
            expect(visibleSlide()).toHaveAccessibleName("3 sur 3");
            expect(visibleSlide()).toHaveAttribute("data-enter", "from-left");
        });

        it("stays on the same message under the threshold", () => {
            render(<BrandCarousel />);
            drag(300, 270);
            expect(visibleSlide()).toHaveAccessibleName("1 sur 3");
        });
    });

    it("stops rotating when paused", async () => {
        render(<BrandCarousel />);
        await userEvent.click(
            screen.getByRole("button", {
                name: "Mettre en pause le défilement",
            }),
        );
        await userEvent.unhover(screen.getByRole("region"));
        act(() => vi.advanceTimersByTime(20000));
        expect(visibleSlide()).toHaveAccessibleName("1 sur 3");
    });

    it("does not rotate when the user prefers reduced motion", () => {
        mockReducedMotion(true);
        render(<BrandCarousel />);
        act(() => vi.advanceTimersByTime(20000));
        expect(visibleSlide()).toHaveAccessibleName("1 sur 3");
        expect(
            screen.queryByRole("button", { name: /défilement/ }),
        ).not.toBeInTheDocument();
    });
});
