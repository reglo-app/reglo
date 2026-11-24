import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DeleteAccountButton } from "./delete-account";

async function openDialog(action = vi.fn().mockResolvedValue({})) {
    render(<DeleteAccountButton email="claire@acme.test" action={action} />);
    await userEvent.click(
        screen.getByRole("button", { name: "Supprimer mon compte" }),
    );
    return {
        action,
        dialog: screen.getByRole("dialog", {
            name: "Supprimer votre compte ?",
        }),
    };
}

describe("DeleteAccountButton", () => {
    it("says what is erased and what the organization keeps", async () => {
        const { dialog } = await openDialog();

        expect(dialog).toHaveTextContent("effacés définitivement");
        expect(dialog).toHaveTextContent(
            "Ce que vous avez fait pour votre organisation est conservé, sans votre nom.",
        );
        expect(within(dialog).getByLabelText("Mot de passe")).toHaveAttribute(
            "autocomplete",
            "current-password",
        );
    });

    it("deletes only after the password and an explicit confirmation", async () => {
        const { dialog, action } = await openDialog();
        const submit = within(dialog).getByRole("button", {
            name: "Supprimer définitivement",
        });
        expect(submit).toBeDisabled();

        await userEvent.type(
            within(dialog).getByLabelText("Mot de passe"),
            "correct-horse-battery",
        );
        expect(submit).toBeDisabled();
        await userEvent.click(
            within(dialog).getByLabelText(
                "Je comprends que mon compte sera supprimé définitivement.",
            ),
        );
        await userEvent.click(submit);

        await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
        const sent = action.mock.calls[0][1] as FormData;
        expect(sent.get("password")).toBe("correct-horse-battery");
        expect(sent.get("confirm")).toBe("on");
    });

    it("shows why the deletion is refused, on the right field", async () => {
        const { dialog } = await openDialog(
            vi.fn().mockResolvedValue({
                error: "Le mot de passe est incorrect.",
                wrongPassword: true,
            }),
        );

        await userEvent.type(
            within(dialog).getByLabelText("Mot de passe"),
            "wrong",
        );
        await userEvent.click(
            within(dialog).getByLabelText(
                "Je comprends que mon compte sera supprimé définitivement.",
            ),
        );
        await userEvent.click(
            within(dialog).getByRole("button", {
                name: "Supprimer définitivement",
            }),
        );

        expect(
            await within(dialog).findByText("Le mot de passe est incorrect."),
        ).toBeInTheDocument();
        expect(within(dialog).getByLabelText("Mot de passe")).toHaveAttribute(
            "aria-invalid",
            "true",
        );
        // The confirmation is asked again, box and button together.
        expect(
            within(dialog).getByLabelText(
                "Je comprends que mon compte sera supprimé définitivement.",
            ),
        ).not.toBeChecked();
        expect(
            within(dialog).getByRole("button", {
                name: "Supprimer définitivement",
            }),
        ).toBeDisabled();
    });

    it("can be cancelled with the keyboard, the focus back on the button", async () => {
        const { action } = await openDialog();

        await userEvent.keyboard("{Escape}");

        await waitFor(() =>
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
        );
        expect(
            screen.getByRole("button", { name: "Supprimer mon compte" }),
        ).toHaveFocus();
        expect(action).not.toHaveBeenCalled();
    });
});
