import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { InterfaceSwitch } from "./interface-switch";
import { UserMenu } from "./user-menu";

describe("UserMenu", () => {
    it("shows the organization next to the role", async () => {
        render(
            <UserMenu
                fullName="Camille Martin"
                roleLabel="Administrateur"
                organizationName="Atelier Démo"
            />,
        );
        const trigger = screen.getByRole("button", {
            name: "Menu de Camille Martin, Atelier Démo",
        });

        await userEvent.click(trigger);

        expect(
            await screen.findByText("Administrateur · Atelier Démo"),
        ).toBeInTheDocument();
    });

    it("works for an account without organization yet", async () => {
        render(
            <UserMenu
                fullName="ana@demo.test"
                roleLabel="Membre"
                organizationName={null}
            />,
        );
        const trigger = screen.getByRole("button", {
            name: "Menu de ana@demo.test",
        });

        await userEvent.click(trigger);

        expect(await screen.findByText("Membre")).toBeInTheDocument();
        expect(screen.queryByText(/·/)).not.toBeInTheDocument();
    });

    it("has no link to the back office: the interface switch does it", async () => {
        render(
            <UserMenu
                fullName="Sacha Equipe"
                roleLabel="Équipe Réglo"
                organizationName={null}
            />,
        );
        await userEvent.click(screen.getByRole("button"));

        expect(
            await screen.findByRole("menuitem", { name: "Mon profil" }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("menuitem", { name: /back office|admin/i }),
        ).not.toBeInTheDocument();
    });
});

describe("InterfaceSwitch", () => {
    it.each([
        [
            "admin",
            "Interface administrateur",
            "Interface utilisateur",
            "/dashboard",
        ],
        ["app", "Interface utilisateur", "Interface administrateur", "/admin"],
    ] as const)(
        "in the %s interface, shows it and offers the other one",
        async (current, currentLabel, otherLabel, otherHref) => {
            render(<InterfaceSwitch current={current} />);
            const trigger = screen.getByRole("button", {
                name: `${currentLabel} : changer d'interface`,
            });

            await userEvent.click(trigger);

            expect(
                await screen.findByRole("menuitem", { name: otherLabel }),
            ).toHaveAttribute("href", otherHref);
            expect(
                screen.getByRole("menuitem", { name: currentLabel }),
            ).toHaveAttribute("aria-current", "page");
        },
    );

    it("opens and moves with the keyboard", async () => {
        render(<InterfaceSwitch current="admin" />);

        await userEvent.tab();
        await userEvent.keyboard("{Enter}");

        expect(
            await screen.findByRole("menuitem", {
                name: "Interface administrateur",
            }),
        ).toHaveFocus();
        await userEvent.keyboard("{ArrowDown}");
        expect(
            screen.getByRole("menuitem", { name: "Interface utilisateur" }),
        ).toHaveFocus();
    });
});
