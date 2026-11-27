import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockTrainingDetails, mockTrainings } from "@/lib/api/mocks";

import { LessonCompleteButton } from "./lesson-complete-button";
import { LessonPlayer } from "./lesson-player";
import { TrainingFilters } from "./training-filters";
import { TrainingList } from "./training-list";

const { routerReplace, toastSuccess } = vi.hoisted(() => ({
    routerReplace: vi.fn(),
    toastSuccess: vi.fn(),
}));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: routerReplace }),
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));
// The real server action cannot run in jsdom: each test injects its own.
vi.mock("@/lib/trainings/actions", () => ({ setLessonCompleted: vi.fn() }));

afterEach(() => {
    vi.clearAllMocks();
});

const [duerp, , haccp] = mockTrainingDetails;

describe("TrainingList", () => {
    it("shows each course with its domain, access and progress", () => {
        render(<TrainingList trainings={mockTrainings} />);

        expect(screen.getAllByRole("listitem")).toHaveLength(3);
        const link = screen.getByRole("link", { name: "Initiation au DUERP" });
        expect(link).toHaveAttribute("href", "/trainings/initiation-duerp");
        expect(
            screen.getByRole("progressbar", {
                name: "Progression : Initiation au DUERP",
            }),
        ).toHaveAttribute("aria-valuetext", "1 leçon terminée sur 3");

        const paid = screen
            .getByRole("link", { name: haccp.title })
            .closest("li");
        expect(paid).not.toBeNull();
        expect(within(paid!).getByText("Payante")).toBeInTheDocument();
        expect(
            within(paid!).getByText("Disponible prochainement"),
        ).toBeInTheDocument();
        expect(within(paid!).queryByRole("progressbar")).toBeNull();
    });
});

describe("TrainingFilters", () => {
    it("keeps the chosen filters in the URL and counts the courses", async () => {
        render(<TrainingFilters filters={{ access: "free" }} count={2} />);

        expect(screen.getByRole("status")).toHaveTextContent("2 formations");
        await userEvent.selectOptions(
            screen.getByLabelText("Domaine"),
            "safety",
        );

        expect(routerReplace).toHaveBeenCalledWith(
            "/trainings?access=free&domain=safety",
            { scroll: false },
        );
    });
});

describe("LessonPlayer", () => {
    it("opens the first lesson when none is chosen", () => {
        render(<LessonPlayer training={duerp} />);

        expect(
            screen.getByRole("heading", {
                level: 2,
                name: "À quoi sert le document unique ?",
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText("Leçon 1 sur 3 · Lecture · 5 min"),
        ).toBeVisible();
        expect(
            screen.getByText("Une obligation de l'employeur."),
        ).toBeVisible();
        // First lesson: no previous one.
        expect(
            screen.queryByRole("link", { name: "Leçon précédente" }),
        ).toBeNull();
        expect(
            screen.getByRole("link", { name: "Leçon suivante" }),
        ).toHaveAttribute("href", "/trainings/initiation-duerp?lesson=video");
    });

    it("marks the current lesson and the done ones in the list", () => {
        render(<LessonPlayer training={duerp} lessonId="video" />);

        const nav = screen.getByRole("navigation", {
            name: "Leçons de la formation",
        });
        expect(
            within(nav).getByRole("link", { current: "page" }),
        ).toHaveTextContent("2. Évaluer les risques en vidéo");
        expect(
            within(nav).getByRole("link", {
                name: "1. À quoi sert le document unique ? (terminée)",
            }),
        ).toBeInTheDocument();
    });

    it("shows a video with its title and its transcript", () => {
        render(<LessonPlayer training={duerp} lessonId="video" />);

        expect(
            screen.getByTitle("Vidéo : Évaluer les risques en vidéo"),
        ).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/demo");
        expect(
            screen.getByRole("heading", { name: "Transcription de la vidéo" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Leçon précédente" }),
        ).toHaveAttribute("href", "/trainings/initiation-duerp?lesson=role");
    });

    it("opens a PDF in a new tab, and has no next lesson at the end", () => {
        render(<LessonPlayer training={duerp} lessonId="guide" />);

        const pdf = screen.getByRole("link", {
            name: "Ouvrir le document PDF (nouvel onglet)",
        });
        expect(pdf).toHaveAttribute(
            "href",
            "https://example.com/guide-duerp.pdf",
        );
        expect(pdf).toHaveAttribute("target", "_blank");
        expect(pdf).toHaveAttribute("rel", "noopener noreferrer");
        expect(
            screen.queryByRole("link", { name: "Leçon suivante" }),
        ).toBeNull();
    });
});

describe("LessonCompleteButton", () => {
    it("marks the lesson as done and tells the progress", async () => {
        const save = vi.fn().mockResolvedValue({
            ok: true,
            progress: { completedCount: 2, lessonCount: 3 },
        });
        render(
            <LessonCompleteButton
                courseId="initiation-duerp"
                lessonId="video"
                completed={false}
                save={save}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Marquer comme terminée" }),
        );

        expect(save).toHaveBeenCalledWith("initiation-duerp", "video", true);
        expect(toastSuccess).toHaveBeenCalledWith("Leçon terminée (2 / 3).");
    });

    it("can undo a done lesson", async () => {
        const save = vi.fn().mockResolvedValue({
            ok: true,
            progress: { completedCount: 0, lessonCount: 3 },
        });
        render(
            <LessonCompleteButton
                courseId="initiation-duerp"
                lessonId="role"
                completed
                save={save}
            />,
        );

        expect(screen.getByText("Leçon terminée")).toBeVisible();
        await userEvent.click(
            screen.getByRole("button", { name: "Marquer comme non terminée" }),
        );

        expect(save).toHaveBeenCalledWith("initiation-duerp", "role", false);
    });

    it("shows the message of the API when it refuses", async () => {
        const save = vi.fn().mockResolvedValue({
            error: "Cette formation sera disponible prochainement.",
        });
        render(
            <LessonCompleteButton
                courseId="hygiene-haccp"
                lessonId="dangers"
                completed={false}
                save={save}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Marquer comme terminée" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Cette formation sera disponible prochainement.",
        );
        expect(toastSuccess).not.toHaveBeenCalled();
    });
});
