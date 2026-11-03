import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AvatarForm, type AvatarFormProps } from "./avatar-form";
import { EmailConfirmationForm } from "./email-confirmation-form";
import { EmailForm } from "./email-form";
import { PasswordForm } from "./password-form";
import { ProfileForm } from "./profile-form";

const USER = { firstName: "Camille", lastName: "Martin", jobTitle: null };

describe("ProfileForm", () => {
    it("shows the current values in labelled fields", () => {
        render(<ProfileForm user={USER} action={vi.fn()} />);

        expect(screen.getByLabelText("Prénom")).toHaveValue("Camille");
        expect(screen.getByLabelText("Prénom")).toHaveAttribute(
            "autocomplete",
            "given-name",
        );
        expect(screen.getByLabelText("Nom")).toHaveValue("Martin");
        expect(screen.getByLabelText("Fonction")).toHaveAccessibleDescription(
            "Facultatif. Par exemple : Responsable QHSE, Dirigeant.",
        );
    });

    it("sends the fields and keeps them when the save fails", async () => {
        const action = vi.fn().mockResolvedValue({
            error: "La fonction est trop longue.",
            fieldErrors: { jobTitle: "La fonction est trop longue." },
        });
        render(<ProfileForm user={USER} action={action} />);

        await userEvent.type(screen.getByLabelText("Fonction"), "Dirigeante");
        await userEvent.click(
            screen.getByRole("button", { name: "Enregistrer" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "La fonction est trop longue.",
        );
        const sent = action.mock.calls[0][1] as FormData;
        expect(Object.fromEntries(sent)).toEqual({
            firstName: "Camille",
            lastName: "Martin",
            jobTitle: "Dirigeante",
        });
        const jobTitle = screen.getByLabelText("Fonction");
        expect(jobTitle).toHaveValue("Dirigeante");
        expect(jobTitle).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByLabelText("Prénom")).not.toHaveAttribute(
            "aria-invalid",
        );
    });
});

describe("AvatarForm", () => {
    const user = { id: "7", avatarVersion: null };

    function renderForm(props: Partial<AvatarFormProps> = {}) {
        const { container } = render(
            <AvatarForm
                user={user}
                fullName="Camille Martin"
                upload={vi.fn().mockResolvedValue({})}
                remove={vi.fn().mockResolvedValue({})}
                {...props}
            >
                <h1>Camille Martin</h1>
            </AvatarForm>,
        );
        return container.querySelector<HTMLInputElement>('input[type="file"]')!;
    }

    it("sends the chosen image at once", async () => {
        const upload = vi.fn().mockResolvedValue({});
        const input = renderForm({ upload });
        const file = new File(["png"], "photo.png", { type: "image/png" });

        await userEvent.upload(input, file);

        await vi.waitFor(() => expect(upload).toHaveBeenCalled());
        // jsdom cannot decode images: the small file is sent as is.
        expect((upload.mock.calls[0][1] as FormData).get("file")).toEqual(file);
    });

    it("shows the initials and the add button without photo", () => {
        renderForm();

        expect(screen.getByText("CM")).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: "Camille Martin" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Ajouter une photo de profil" }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", {
                name: "Modifier la photo de profil",
            }),
        ).not.toBeInTheDocument();
    });

    it("removes the photo from the photo menu", async () => {
        const remove = vi.fn().mockResolvedValue({});
        renderForm({ user: { id: "7", avatarVersion: "1793" }, remove });

        await userEvent.click(
            screen.getByRole("button", { name: "Modifier la photo de profil" }),
        );
        expect(
            await screen.findByRole("menuitem", { name: "Changer la photo" }),
        ).toBeInTheDocument();
        await userEvent.click(
            screen.getByRole("menuitem", { name: "Supprimer la photo" }),
        );

        await vi.waitFor(() => expect(remove).toHaveBeenCalled());
    });

    it("refuses a photo too large to be reduced, without sending it", async () => {
        const upload = vi.fn();
        const input = renderForm({ upload });

        await userEvent.upload(
            input,
            new File([new Uint8Array(6 * 1024 * 1024)], "photo.png", {
                type: "image/png",
            }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "L'image ne doit pas dépasser 5 Mo.",
        );
        expect(upload).not.toHaveBeenCalled();
    });

    it("shows an upload error", async () => {
        const upload = vi.fn().mockResolvedValue({
            error: "Choisissez une image JPEG, PNG ou WebP.",
        });
        const input = renderForm({ upload });

        await userEvent.upload(
            input,
            new File(["x"], "photo.png", { type: "image/png" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Choisissez une image JPEG, PNG ou WebP.",
        );
    });
});

describe("EmailForm", () => {
    it("sends the new address with the password", async () => {
        const action = vi.fn().mockResolvedValue({ sentTo: "new@acme.test" });
        render(<EmailForm currentEmail="old@acme.test" action={action} />);

        expect(screen.getByText("old@acme.test")).toBeInTheDocument();
        await userEvent.type(
            screen.getByLabelText("Nouvelle adresse e-mail"),
            "new@acme.test",
        );
        await userEvent.type(
            screen.getByLabelText("Mot de passe actuel"),
            "my-password",
        );
        await userEvent.click(
            screen.getByRole("button", {
                name: "Envoyer le lien de confirmation",
            }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "un lien de confirmation vient d'y être envoyé",
        );
        expect(Object.fromEntries(action.mock.calls[0][1] as FormData)).toEqual(
            { email: "new@acme.test", currentPassword: "my-password" },
        );
    });

    it("marks the refused field", async () => {
        const action = vi.fn().mockResolvedValue({
            error: "Le mot de passe actuel est incorrect.",
            invalidFields: ["currentPassword"],
        });
        render(<EmailForm currentEmail="old@acme.test" action={action} />);

        await userEvent.type(
            screen.getByLabelText("Nouvelle adresse e-mail"),
            "new@acme.test",
        );
        await userEvent.click(
            screen.getByRole("button", {
                name: "Envoyer le lien de confirmation",
            }),
        );

        // The field exists before the answer: wait for the answer first.
        await screen.findByRole("alert");
        const password = screen.getByLabelText("Mot de passe actuel");
        expect(password).toHaveAttribute("aria-invalid", "true");
        expect(password).toHaveAccessibleDescription(
            "Pour confirmer que c'est bien vous. Le mot de passe actuel est incorrect.",
        );
        expect(screen.getByLabelText("Nouvelle adresse e-mail")).toHaveValue(
            "new@acme.test",
        );
    });
});

describe("PasswordForm", () => {
    it("has the autocomplete of a password change", () => {
        render(<PasswordForm email="camille@acme.test" action={vi.fn()} />);

        expect(screen.getByLabelText("Mot de passe actuel")).toHaveAttribute(
            "autocomplete",
            "current-password",
        );
        expect(screen.getByLabelText("Nouveau mot de passe")).toHaveAttribute(
            "autocomplete",
            "new-password",
        );
        expect(
            screen.getByLabelText("Nouveau mot de passe"),
        ).toHaveAccessibleDescription("12 caractères minimum.");
    });

    it("shows all the passwords at once", async () => {
        render(<PasswordForm email="camille@acme.test" action={vi.fn()} />);

        await userEvent.click(
            screen.getByRole("button", { name: "Afficher les mots de passe" }),
        );

        for (const label of [
            "Mot de passe actuel",
            "Nouveau mot de passe",
            "Confirmez le nouveau mot de passe",
        ]) {
            expect(screen.getByLabelText(label)).toHaveAttribute(
                "type",
                "text",
            );
        }
    });

    it("shows the error on the refused field", async () => {
        const action = vi.fn().mockResolvedValue({
            error: "Les deux mots de passe ne sont pas identiques.",
            invalidFields: ["confirmation"],
        });
        render(<PasswordForm email="camille@acme.test" action={action} />);

        await userEvent.click(
            screen.getByRole("button", { name: "Modifier le mot de passe" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Les deux mots de passe ne sont pas identiques.",
        );
        expect(
            screen.getByLabelText("Confirmez le nouveau mot de passe"),
        ).toHaveAttribute("aria-invalid", "true");
    });
});

describe("EmailConfirmationForm", () => {
    it("confirms with the token, then offers to log in", async () => {
        const action = vi.fn().mockResolvedValue({ confirmed: true });
        render(
            <EmailConfirmationForm
                token="abc"
                newEmail="new@acme.test"
                action={action}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", {
                name: "Confirmer ma nouvelle adresse",
            }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Votre adresse e-mail est maintenant new@acme.test",
        );
        expect(
            screen.getByRole("link", { name: "Se connecter" }),
        ).toHaveAttribute("href", "/login");
        expect((action.mock.calls[0][1] as FormData).get("token")).toBe("abc");
    });

    it("disables the button once the link expired", async () => {
        const action = vi.fn().mockResolvedValue({
            error: "Ce lien de confirmation a expiré ou a déjà été utilisé.",
            expired: true,
        });
        render(
            <EmailConfirmationForm
                token="abc"
                newEmail="new@acme.test"
                action={action}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", {
                name: "Confirmer ma nouvelle adresse",
            }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Refaites la demande depuis votre profil.",
        );
        expect(
            screen.getByRole("button", {
                name: "Confirmer ma nouvelle adresse",
            }),
        ).toBeDisabled();
    });
});
