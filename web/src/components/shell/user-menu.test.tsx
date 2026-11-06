import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

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

    it("links to the back office for the REGLO team only", async () => {
        const { unmount } = render(
            <UserMenu
                fullName="Camille Martin"
                roleLabel="Administrateur"
                organizationName="Atelier Démo"
            />,
        );
        await userEvent.click(screen.getByRole("button"));
        expect(
            await screen.findByRole("menuitem", { name: "Mon profil" }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("menuitem", { name: "Back office" }),
        ).not.toBeInTheDocument();
        unmount();

        render(
            <UserMenu
                fullName="Sacha Equipe"
                roleLabel="Équipe Réglo"
                organizationName={null}
                platformAdmin
            />,
        );
        await userEvent.click(screen.getByRole("button"));
        expect(
            await screen.findByRole("menuitem", { name: "Back office" }),
        ).toHaveAttribute("href", "/admin");
    });
});
