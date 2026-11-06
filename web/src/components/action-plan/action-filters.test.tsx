import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActionFilters } from "@/components/action-plan/action-filters";
import {
    DueBadge,
    NoMatchingAction,
} from "@/components/action-plan/action-list";
import { mockActions } from "@/lib/api/mocks";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace }),
}));

const assignees = [
    { id: "7", firstName: "Hugo", lastName: "Bernard", email: "h@test.fr" },
    { id: "8", firstName: null, lastName: null, email: "lea@test.fr" },
];

beforeEach(() => replace.mockClear());

describe("ActionFilters", () => {
    it("gives every filter a label and the chosen values", () => {
        render(
            <ActionFilters
                filters={{ status: "todo", assignee: "8", due: "soon" }}
                assignees={assignees}
                count={2}
            />,
        );

        expect(screen.getByLabelText("Statut")).toHaveValue("todo");
        expect(screen.getByLabelText("Domaine")).toHaveValue("");
        expect(screen.getByLabelText("Type")).toHaveValue("");
        expect(screen.getByLabelText("Responsable")).toHaveValue("8");
        expect(screen.getByLabelText("Échéance")).toHaveValue("soon");
        expect(screen.getByLabelText("Tri par échéance")).toHaveValue("asc");
        expect(
            screen.getByRole("option", { name: "Hugo Bernard" }),
        ).toBeInTheDocument();
        // No name known: the e-mail.
        expect(
            screen.getByRole("option", { name: "lea@test.fr" }),
        ).toBeInTheDocument();
    });

    it("puts a filter in the URL, keeps the others and the focus", async () => {
        render(
            <ActionFilters
                filters={{ status: "todo" }}
                assignees={assignees}
                count={2}
            />,
        );

        const due = screen.getByLabelText("Échéance");
        await userEvent.selectOptions(due, "overdue");

        await waitFor(() =>
            expect(replace).toHaveBeenCalledWith(
                "/actions?status=todo&due=overdue",
                { scroll: false },
            ),
        );
        expect(due).toHaveFocus();
    });

    it("removes a filter set back to all", async () => {
        render(
            <ActionFilters
                filters={{ status: "todo", due: "soon" }}
                assignees={assignees}
                count={2}
            />,
        );

        await userEvent.selectOptions(screen.getByLabelText("Statut"), "");

        await waitFor(() =>
            expect(replace).toHaveBeenCalledWith("/actions?due=soon", {
                scroll: false,
            }),
        );
    });

    it("keeps the default order out of the URL", async () => {
        const { rerender } = render(
            <ActionFilters filters={{}} assignees={assignees} count={2} />,
        );

        await userEvent.selectOptions(
            screen.getByLabelText("Tri par échéance"),
            "desc",
        );
        await waitFor(() =>
            expect(replace).toHaveBeenLastCalledWith("/actions?order=desc", {
                scroll: false,
            }),
        );

        rerender(
            <ActionFilters
                filters={{ order: "desc" }}
                assignees={assignees}
                count={2}
            />,
        );
        await userEvent.selectOptions(
            screen.getByLabelText("Tri par échéance"),
            "asc",
        );
        await waitFor(() =>
            expect(replace).toHaveBeenLastCalledWith("/actions", {
                scroll: false,
            }),
        );
    });

    it("clears the filters, keeps the order and does not lose the focus", async () => {
        render(
            <ActionFilters
                filters={{ status: "todo", due: "soon", order: "desc" }}
                assignees={assignees}
                count={1}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Effacer les filtres" }),
        );

        await waitFor(() =>
            expect(replace).toHaveBeenCalledWith("/actions?order=desc", {
                scroll: false,
            }),
        );
        expect(screen.getByLabelText("Statut")).toHaveFocus();
    });

    it("offers no clearing without filter, even with an order", () => {
        render(
            <ActionFilters
                filters={{ order: "desc" }}
                assignees={assignees}
                count={1}
            />,
        );

        expect(
            screen.queryByRole("button", { name: "Effacer les filtres" }),
        ).not.toBeInTheDocument();
    });

    it.each([
        [0, "Aucune action"],
        [1, "1 action"],
        [4, "4 actions"],
    ])("tells screen readers how many actions: %i", (count, text) => {
        render(
            <ActionFilters filters={{}} assignees={assignees} count={count} />,
        );

        expect(screen.getByRole("status")).toHaveTextContent(text);
    });
});

describe("DueBadge", () => {
    it("says a late action in words", () => {
        render(
            <DueBadge
                action={{
                    ...mockActions[0],
                    isOverdue: true,
                    isDueSoon: false,
                }}
            />,
        );
        expect(screen.getByText("En retard")).toHaveAttribute(
            "data-variant",
            "destructive",
        );
    });

    it("says a soon due action in words", () => {
        render(
            <DueBadge
                action={{
                    ...mockActions[0],
                    isOverdue: false,
                    isDueSoon: true,
                }}
            />,
        );
        expect(screen.getByText("Échéance proche")).toHaveAttribute(
            "data-variant",
            "warning",
        );
    });

    it("says nothing otherwise", () => {
        const { container } = render(
            <DueBadge
                action={{
                    ...mockActions[0],
                    isOverdue: false,
                    isDueSoon: false,
                }}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });
});

describe("NoMatchingAction", () => {
    it("explains why the list is empty", () => {
        render(<NoMatchingAction />);
        expect(
            screen.getByText("Aucune action ne correspond à ces filtres."),
        ).toBeInTheDocument();
    });
});
