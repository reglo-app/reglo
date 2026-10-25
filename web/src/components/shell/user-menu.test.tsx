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
});
