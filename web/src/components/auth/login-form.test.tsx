import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginForm, REMEMBERED_EMAIL_KEY } from "./login-form";

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

    describe("remember me", () => {
        afterEach(() => localStorage.clear());

        async function submit(email: string, remember: boolean) {
            render(<LoginForm action={vi.fn().mockResolvedValue({})} />);
            await userEvent.type(
                screen.getByLabelText("Adresse e-mail"),
                email,
            );
            await userEvent.type(screen.getByLabelText("Mot de passe"), "x");
            if (remember) {
                await userEvent.click(
                    screen.getByLabelText("Se souvenir de moi"),
                );
            }
            await userEvent.click(
                screen.getByRole("button", { name: "Se connecter" }),
            );
        }

        it("stores the e-mail when checked", async () => {
            await submit("ana@demo.test", true);
            expect(localStorage.getItem(REMEMBERED_EMAIL_KEY)).toBe(
                "ana@demo.test",
            );
        });

        it("forgets the e-mail when unchecked", async () => {
            localStorage.setItem(REMEMBERED_EMAIL_KEY, "old@demo.test");
            render(<LoginForm action={vi.fn().mockResolvedValue({})} />);
            await userEvent.click(screen.getByLabelText("Se souvenir de moi"));
            await userEvent.type(screen.getByLabelText("Mot de passe"), "x");
            await userEvent.click(
                screen.getByRole("button", { name: "Se connecter" }),
            );
            expect(localStorage.getItem(REMEMBERED_EMAIL_KEY)).toBeNull();
        });

        it("prefills the remembered e-mail and checks the box", () => {
            localStorage.setItem(REMEMBERED_EMAIL_KEY, "ana@demo.test");
            render(<LoginForm action={vi.fn()} />);
            expect(screen.getByLabelText("Adresse e-mail")).toHaveValue(
                "ana@demo.test",
            );
            expect(screen.getByLabelText("Se souvenir de moi")).toBeChecked();
        });

        it("does not send the checkbox to the server", async () => {
            const action = vi.fn().mockResolvedValue({});
            render(<LoginForm action={action} />);
            await userEvent.click(screen.getByLabelText("Se souvenir de moi"));
            await userEvent.click(
                screen.getByRole("button", { name: "Se connecter" }),
            );
            const formData = action.mock.calls[0][1] as FormData;
            expect([...formData.keys()]).toEqual(["email", "password"]);
        });
    });
});
