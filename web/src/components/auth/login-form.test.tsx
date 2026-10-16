import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";

describe("LoginForm", () => {
    it("has labelled fields with the right autocomplete", () => {
        render(<LoginForm action={vi.fn()} />);

        expect(screen.getByLabelText("Adresse e-mail")).toHaveAttribute(
            "autocomplete",
            "username",
        );
        expect(screen.getByLabelText("Mot de passe")).toHaveAttribute(
            "autocomplete",
            "current-password",
        );
    });

    it("sends the credentials and the target page", async () => {
        const action = vi.fn().mockResolvedValue({});
        render(<LoginForm next="/actions" action={action} />);

        await userEvent.type(
            screen.getByLabelText("Adresse e-mail"),
            "ana@demo.test",
        );
        await userEvent.type(screen.getByLabelText("Mot de passe"), "secret");
        await userEvent.click(
            screen.getByRole("button", { name: "Se connecter" }),
        );

        expect(action).toHaveBeenCalledOnce();
        const formData = action.mock.calls[0][1] as FormData;
        expect(formData.get("email")).toBe("ana@demo.test");
        expect(formData.get("password")).toBe("secret");
        expect(formData.get("next")).toBe("/actions");
    });

    it("shows the error, keeps the e-mail and marks the fields invalid", async () => {
        const action = vi.fn().mockResolvedValue({
            error: "Identifiants incorrects",
            email: "ana@demo.test",
        });
        render(<LoginForm action={action} />);

        await userEvent.type(
            screen.getByLabelText("Adresse e-mail"),
            "ana@demo.test",
        );
        await userEvent.type(screen.getByLabelText("Mot de passe"), "wrong");
        await userEvent.click(
            screen.getByRole("button", { name: "Se connecter" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Identifiants incorrects",
        );
        const email = screen.getByLabelText("Adresse e-mail");
        expect(email).toHaveValue("ana@demo.test");
        expect(email).toHaveAttribute("aria-invalid", "true");
        expect(email).toHaveAccessibleDescription("Identifiants incorrects");
    });

    it("shows and hides the password", async () => {
        render(<LoginForm action={vi.fn()} />);
        const password = screen.getByLabelText("Mot de passe");
        const toggle = screen.getByRole("button", {
            name: "Afficher le mot de passe",
        });

        expect(password).toHaveAttribute("type", "password");
        await userEvent.click(toggle);
        expect(password).toHaveAttribute("type", "text");
        expect(toggle).toHaveAttribute("aria-pressed", "true");
    });
});
