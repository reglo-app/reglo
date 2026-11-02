import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActivationForm } from "./activation-form";
import { ResendActivationForm } from "./resend-activation-form";
import { ACTIVATED_EMAIL_KEY } from "@/lib/auth/activated-email";

const EMAIL = "claire@acme.test";

async function submit(password: string, confirmation = password) {
    await userEvent.type(
        screen.getByLabelText("Mot de passe", { exact: true }),
        password,
    );
    await userEvent.type(
        screen.getByLabelText("Confirmez le mot de passe"),
        confirmation,
    );
    await userEvent.click(
        screen.getByRole("button", { name: "Activer mon compte" }),
    );
}

describe("ActivationForm", () => {
    it("has labelled password fields for a new password", () => {
        render(<ActivationForm token="t" email={EMAIL} action={vi.fn()} />);

        const password = screen.getByLabelText("Mot de passe", {
            exact: true,
        });
        expect(password).toHaveAttribute("autocomplete", "new-password");
        expect(password).toHaveAccessibleDescription("12 caractères minimum.");
        expect(
            screen.getByLabelText("Confirmez le mot de passe"),
        ).toHaveAttribute("autocomplete", "new-password");
    });

    it("sends the token and both passwords, not the e-mail", async () => {
        const action = vi.fn().mockResolvedValue({});
        render(<ActivationForm token="abc" email={EMAIL} action={action} />);

        await submit("correct-horse-battery");

        const formData = action.mock.calls[0][1] as FormData;
        expect(Object.fromEntries(formData)).toEqual({
            token: "abc",
            password: "correct-horse-battery",
            confirmation: "correct-horse-battery",
        });
    });

    it("hands the e-mail to the login page opened next", async () => {
        render(
            <ActivationForm
                token="t"
                email={EMAIL}
                action={vi.fn().mockResolvedValue({})}
            />,
        );

        await submit("correct-horse-battery");

        expect(sessionStorage.getItem(ACTIVATED_EMAIL_KEY)).toBe(EMAIL);
        sessionStorage.clear();
    });

    it("shows the error and marks the field in error", async () => {
        const action = vi.fn().mockResolvedValue({
            error: "Les deux mots de passe ne sont pas identiques.",
            invalidFields: ["confirmation"],
        });
        render(<ActivationForm token="t" email={EMAIL} action={action} />);

        await submit("correct-horse-battery", "other-password-1");

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Les deux mots de passe ne sont pas identiques.",
        );
        const confirmation = screen.getByLabelText("Confirmez le mot de passe");
        expect(confirmation).toHaveAttribute("aria-invalid", "true");
        expect(confirmation).toHaveAccessibleDescription(
            "Les deux mots de passe ne sont pas identiques.",
        );
        expect(
            screen.getByLabelText("Mot de passe", { exact: true }),
        ).not.toHaveAttribute("aria-invalid");

        await userEvent.type(confirmation, "x");
        expect(confirmation).not.toHaveAttribute("aria-invalid");
    });

    it("offers a new link when the link expired meanwhile", async () => {
        const action = vi.fn().mockResolvedValue({
            error: "Ce lien d'activation a expiré ou a déjà été utilisé.",
            linkExpired: true,
        });
        render(<ActivationForm token="t" email={EMAIL} action={action} />);

        await submit("correct-horse-battery");

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Ce lien d'activation a expiré",
        );
        expect(screen.getByLabelText("Adresse e-mail")).toHaveValue(EMAIL);
        expect(
            screen.getByRole("button", { name: "Recevoir un nouveau lien" }),
        ).toBeInTheDocument();
    });

    it("shows both passwords at once", async () => {
        render(<ActivationForm token="t" email={EMAIL} action={vi.fn()} />);

        await userEvent.click(
            screen.getByRole("button", { name: "Afficher les mots de passe" }),
        );

        expect(
            screen.getByLabelText("Mot de passe", { exact: true }),
        ).toHaveAttribute("type", "text");
        expect(
            screen.getByLabelText("Confirmez le mot de passe"),
        ).toHaveAttribute("type", "text");
    });
});

describe("ResendActivationForm", () => {
    it("sends the e-mail and confirms without telling if the account exists", async () => {
        const action = vi.fn().mockResolvedValue({ sent: true });
        render(<ResendActivationForm action={action} />);

        await userEvent.type(
            screen.getByLabelText("Adresse e-mail"),
            "claire@acme.test",
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Recevoir un nouveau lien" }),
        );

        expect((action.mock.calls[0][1] as FormData).get("email")).toBe(
            "claire@acme.test",
        );
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Si un compte en attente d'activation correspond à cette adresse",
        );
    });

    it("shows the error linked to the field", async () => {
        const action = vi
            .fn()
            .mockResolvedValue({ error: "Saisissez votre adresse e-mail." });
        render(<ResendActivationForm action={action} />);

        await userEvent.click(
            screen.getByRole("button", { name: "Recevoir un nouveau lien" }),
        );

        expect(
            await screen.findByLabelText("Adresse e-mail"),
        ).toHaveAccessibleDescription("Saisissez votre adresse e-mail.");
    });
});
