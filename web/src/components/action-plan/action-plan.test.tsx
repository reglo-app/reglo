import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { mockActionDetails, mockActions, mockMembers } from "@/lib/api/mocks";

import { ActionForm } from "./action-form";
import { DeleteActionButton, StatusControl } from "./action-controls";
import { ActionDetailView } from "./action-detail";
import { ActionList, NoAction } from "./action-list";

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const TODAY = "2026-10-16";

function renderForm(props: Partial<Parameters<typeof ActionForm>[0]> = {}) {
    const save = vi.fn().mockResolvedValue({});
    render(
        <ActionForm
            members={mockMembers}
            today={TODAY}
            save={save}
            {...props}
        />,
    );
    return save;
}

describe("ActionForm", () => {
    it("labels every field and offers only members who can be responsible", () => {
        renderForm();

        for (const label of [
            "Titre",
            "Description (facultatif)",
            "Domaine",
            "Type",
            "Responsable",
            "Échéance",
        ]) {
            expect(screen.getByLabelText(label)).toBeInTheDocument();
        }
        const assignee = screen.getByLabelText("Responsable");
        // Readers (Inès Petit) and members not activated (Samuel Girard)
        // cannot be responsible.
        expect(
            within(assignee).getByRole("option", { name: /Hugo Bernard/ }),
        ).toBeInTheDocument();
        expect(
            within(assignee).queryByRole("option", { name: /Inès Petit/ }),
        ).not.toBeInTheDocument();
        expect(
            within(assignee).queryByRole("option", { name: /Samuel Girard/ }),
        ).not.toBeInTheDocument();
        expect(screen.getByLabelText("Échéance")).toHaveAttribute("min", TODAY);
    });

    it("sends what was typed", async () => {
        const save = renderForm();

        await userEvent.type(screen.getByLabelText("Titre"), "Former l'équipe");
        await userEvent.selectOptions(
            screen.getByLabelText("Domaine"),
            "safety",
        );
        await userEvent.selectOptions(
            screen.getByLabelText("Type"),
            "preventive",
        );
        expect(
            screen.getByText("Évite qu'un risque ne se produise."),
        ).toBeInTheDocument();
        await userEvent.selectOptions(
            screen.getByLabelText("Responsable"),
            mockMembers[1].id,
        );
        await userEvent.type(screen.getByLabelText("Échéance"), "2026-11-30");
        await userEvent.click(
            screen.getByRole("button", { name: "Créer l'action" }),
        );

        await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
        const [actionId, , data] = save.mock.calls[0] as [
            string | null,
            unknown,
            FormData,
        ];
        expect(actionId).toBeNull();
        expect(Object.fromEntries(data)).toEqual({
            title: "Former l'équipe",
            description: "",
            domain: "safety",
            type: "preventive",
            assigneeId: mockMembers[1].id,
            dueDate: "2026-11-30",
        });
    });

    it("links each refused field to its message and focuses the first one", async () => {
        const save = vi.fn().mockResolvedValue({
            error: "L'action n'est pas enregistrée : corrigez les champs signalés.",
            fieldErrors: {
                assigneeId: "Choisissez le responsable de l'action.",
                dueDate: "L'échéance ne peut pas être dans le passé.",
            },
        });
        renderForm({ save });

        await userEvent.click(
            screen.getByRole("button", { name: "Créer l'action" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "corrigez les champs signalés",
        );
        const assignee = screen.getByLabelText("Responsable");
        // The focus moves just after the message appears.
        await waitFor(() => expect(assignee).toHaveFocus());
        expect(assignee).toHaveAttribute("aria-invalid", "true");
        expect(assignee).toHaveAccessibleDescription(
            /Choisissez le responsable de l'action\./,
        );
        expect(screen.getByLabelText("Échéance")).toHaveAccessibleDescription(
            /L'échéance ne peut pas être dans le passé\./,
        );
        expect(screen.getByLabelText("Titre")).not.toHaveAttribute(
            "aria-invalid",
        );
    });

    it("keeps the choices made when the action is refused", async () => {
        const save = vi.fn().mockResolvedValue({
            error: "L'action n'est pas enregistrée : corrigez les champs signalés.",
            fieldErrors: { title: "Donnez un titre à l'action." },
        });
        renderForm({ save });

        await userEvent.selectOptions(
            screen.getByLabelText("Type"),
            "preventive",
        );
        await userEvent.selectOptions(
            screen.getByLabelText("Responsable"),
            mockMembers[1].id,
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Créer l'action" }),
        );

        expect(await screen.findByRole("alert")).toBeInTheDocument();
        expect(screen.getByLabelText("Type")).toHaveValue("preventive");
        expect(screen.getByLabelText("Responsable")).toHaveValue(
            mockMembers[1].id,
        );
    });

    it("prefills a new action from the diagnostic result", () => {
        renderForm({
            defaults: { title: "Le DUERP est-il à jour ?", domain: "safety" },
        });

        expect(screen.getByLabelText("Titre")).toHaveValue(
            "Le DUERP est-il à jour ?",
        );
        expect(screen.getByLabelText("Domaine")).toHaveValue("safety");
    });

    it("edits an action, and keeps a due date already past", async () => {
        const late = mockActions[0];
        const save = renderForm({ action: late });

        expect(screen.getByLabelText("Titre")).toHaveValue(late.title);
        expect(screen.getByLabelText("Échéance")).toHaveAttribute(
            "min",
            late.dueDate,
        );
        expect(screen.getByText(/Déjà dépassée/)).toBeInTheDocument();
        await userEvent.click(
            screen.getByRole("button", {
                name: "Enregistrer les modifications",
            }),
        );

        await waitFor(() => expect(save).toHaveBeenCalled());
        expect(save.mock.calls[0][0]).toBe(late.id);
    });
});

describe("ActionList", () => {
    it("links each action and gives its status in words", () => {
        render(<ActionList actions={mockActions} />);

        const items = screen.getAllByRole("listitem");
        expect(items).toHaveLength(4);
        expect(
            within(items[0]).getByRole("link", {
                name: /Mettre à jour le DUERP/,
            }),
        ).toHaveAttribute("href", "/actions/1");
        expect(items[0]).toHaveTextContent("En cours");
        expect(items[0]).toHaveTextContent("Sécurité");
        expect(items[0]).toHaveTextContent("Camille Martin");
        expect(items[0]).toHaveTextContent("Échéance : 10 oct. 2026");
        expect(items[3]).toHaveTextContent("Sans responsable");
        expect(items[3]).toHaveTextContent("Terminée");
    });

    it("leads to the first action, except for a reader", () => {
        const { unmount } = render(<NoAction canEdit />);
        expect(
            screen.getByRole("link", { name: "Nouvelle action" }),
        ).toHaveAttribute("href", "/actions/nouvelle");
        unmount();

        render(<NoAction canEdit={false} />);
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });
});

describe("ActionDetailView", () => {
    const inReview = mockActionDetails[2];

    it("shows the current step and the history, latest first", () => {
        render(
            <ActionDetailView
                action={inReview}
                canChangeStatus
                today={TODAY}
            />,
        );

        expect(
            screen.getByRole("listitem", { current: "step" }),
        ).toHaveTextContent("En revue");
        const history = screen
            .getByRole("heading", { name: "Historique" })
            .closest("[data-slot=card]") as HTMLElement;
        const changes = within(history).getAllByRole("listitem");
        expect(changes).toHaveLength(3);
        expect(changes[0]).toHaveTextContent(
            "Passée à « En revue » (avant : « En cours »)",
        );
        expect(changes[0]).toHaveTextContent("par Julien Roux");
        expect(changes[2]).toHaveTextContent("Action créée");
        expect(screen.getByText("Dans 30 jours")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Passer à « Terminée »" }),
        ).toBeInTheDocument();
    });

    it("explains who can change the status to the others", () => {
        render(
            <ActionDetailView
                action={inReview}
                canChangeStatus={false}
                today={TODAY}
            />,
        );

        expect(screen.queryByRole("button")).not.toBeInTheDocument();
        expect(
            screen.getByText(/Seuls le responsable de l'action/),
        ).toBeInTheDocument();
    });

    it("says when the assignee has left", () => {
        render(
            <ActionDetailView
                action={mockActionDetails[3]}
                canChangeStatus
                today={TODAY}
            />,
        );

        expect(screen.getByText(/a quitté l'organisation/)).toBeInTheDocument();
    });
});

describe("StatusControl", () => {
    it("moves to the next or the previous step", async () => {
        const change = vi.fn().mockResolvedValue({ ok: true });
        render(
            <StatusControl actionId="3" status="in_progress" change={change} />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Passer à « En revue »" }),
        );
        expect(change).toHaveBeenLastCalledWith("3", "in_review");

        const back = screen.getByRole("button", {
            name: "Revenir à « À faire »",
        });
        // Disabled while the first change is sent.
        await waitFor(() => expect(back).toBeEnabled());
        await userEvent.click(back);
        expect(change).toHaveBeenLastCalledWith("3", "todo");
    });

    it("shows why a change was refused", async () => {
        const change = vi
            .fn()
            .mockResolvedValue({ error: "Changement impossible." });
        render(<StatusControl actionId="3" status="todo" change={change} />);

        expect(
            screen.queryByRole("button", { name: /Revenir/ }),
        ).not.toBeInTheDocument();
        await userEvent.click(
            screen.getByRole("button", { name: "Passer à « En cours »" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Changement impossible.",
        );
    });
});

describe("DeleteActionButton", () => {
    it("deletes only once confirmed", async () => {
        const remove = vi.fn().mockResolvedValue({ ok: true });
        render(
            <DeleteActionButton
                actionId="3"
                title="Planifier l'audit"
                remove={remove}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Supprimer" }),
        );
        const dialog = screen.getByRole("dialog", {
            name: "Supprimer cette action ?",
        });
        expect(dialog).toHaveTextContent("« Planifier l'audit »");
        expect(remove).not.toHaveBeenCalled();

        await userEvent.click(
            within(dialog).getByRole("button", { name: "Supprimer l'action" }),
        );
        expect(remove).toHaveBeenCalledWith("3");
    });
});
