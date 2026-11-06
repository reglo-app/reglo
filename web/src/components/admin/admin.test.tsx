import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { AdminUser } from "@/lib/api";
import {
    mockAdminOrganizations,
    mockAdminTeam,
    mockAdminUsers,
} from "@/lib/api/mocks";

import { AccountDialog } from "./admin-form";
import { AccountTable } from "./account-table";
import { OrganizationActions } from "./organization-actions";
import { OrganizationTable } from "./organization-table";

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

const { toast } = await import("sonner");

function dialogProps() {
    return {
        title: "Créer une organisation",
        description: "Un e-mail est envoyé.",
        submitLabel: "Créer l'organisation",
        icon: null,
    };
}

async function openRowMenu(name: string) {
    await userEvent.click(
        screen.getByRole("button", { name: `Actions pour ${name}` }),
    );
}

describe("OrganizationTable", () => {
    it("links to each organization and says who waits for activation", () => {
        render(<OrganizationTable organizations={mockAdminOrganizations} />);

        expect(
            screen.getByRole("heading", { name: "Organisations (2)" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Atelier Démo" }),
        ).toHaveAttribute("href", "/admin/organisations/1");
        expect(screen.getByText("1 en attente")).toBeInTheDocument();
        expect(screen.getByText("Aucune en attente")).toBeInTheDocument();
    });

    it("searches without accents and tells when nothing matches", async () => {
        render(<OrganizationTable organizations={mockAdminOrganizations} />);
        const search = screen.getByRole("searchbox", {
            name: "Rechercher une organisation",
        });

        await userEvent.type(search, "atelier demo");
        expect(screen.getAllByRole("row")).toHaveLength(2);
        expect(screen.getByRole("status")).toHaveTextContent(
            "1 organisation trouvée",
        );

        await userEvent.clear(search);
        await userEvent.type(search, "zzz");
        expect(
            screen.getByText("Aucune organisation ne correspond à « zzz »."),
        ).toBeInTheDocument();
    });

    it("says when there is no organization yet", () => {
        render(<OrganizationTable organizations={[]} />);

        expect(
            screen.getByText("Aucune organisation pour le moment."),
        ).toBeInTheDocument();
    });

    it("shows pages when there are many organizations", async () => {
        const organizations = Array.from({ length: 12 }, (_, index) => ({
            ...mockAdminOrganizations[0],
            id: String(index),
            name: `Organisation ${index}`,
        }));
        render(<OrganizationTable organizations={organizations} />);

        expect(screen.getAllByRole("row")).toHaveLength(11);
        await userEvent.click(screen.getByRole("button", { name: "Page 2" }));
        expect(screen.getAllByRole("row")).toHaveLength(3);
    });
});

describe("AccountDialog", () => {
    it("asks what the organization needs and sends it", async () => {
        const action = vi.fn().mockResolvedValue({ done: "Acme est créée." });
        render(
            <AccountDialog
                {...dialogProps()}
                action={action}
                withOrganizationName
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Créer une organisation" }),
        );
        const dialog = screen.getByRole("dialog");
        await userEvent.type(
            within(dialog).getByLabelText("Nom de l'organisation"),
            "Acme",
        );
        await userEvent.type(
            within(dialog).getByLabelText("Adresse e-mail"),
            "a@acme.test",
        );
        await userEvent.type(within(dialog).getByLabelText("Prénom"), "Ana");
        await userEvent.type(within(dialog).getByLabelText("Nom"), "Roy");
        expect(within(dialog).queryByLabelText("Rôle")).not.toBeInTheDocument();
        await userEvent.click(
            within(dialog).getByRole("button", {
                name: "Créer l'organisation",
            }),
        );

        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith("Acme est créée."),
        );
        const formData = action.mock.calls[0][1] as FormData;
        expect(Object.fromEntries(formData)).toEqual({
            name: "Acme",
            email: "a@acme.test",
            firstName: "Ana",
            lastName: "Roy",
        });
        await waitFor(() =>
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
        );
    });

    it("keeps what was typed and shows the refusal", async () => {
        const action = vi.fn().mockResolvedValue({
            error: "Une organisation porte déjà ce nom.",
            fieldErrors: { name: "Une organisation porte déjà ce nom." },
        });
        render(
            <AccountDialog
                {...dialogProps()}
                action={action}
                withOrganizationName
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Créer une organisation" }),
        );
        const name = screen.getByLabelText("Nom de l'organisation");
        await userEvent.type(name, "Acme");
        await userEvent.click(
            screen.getByRole("button", { name: "Créer l'organisation" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Une organisation porte déjà ce nom.",
        );
        expect(name).toHaveValue("Acme");
        expect(name).toHaveAttribute("aria-invalid", "true");
        expect(name).toHaveAttribute("aria-describedby", "account-error");
        expect(screen.getByLabelText("Adresse e-mail")).not.toHaveAttribute(
            "aria-invalid",
        );
    });

    it("warns when the e-mail could not be sent", async () => {
        const action = vi
            .fn()
            .mockResolvedValue({ warning: "L'e-mail n'a pas pu être envoyé." });
        render(<AccountDialog {...dialogProps()} action={action} />);

        await userEvent.click(
            screen.getByRole("button", { name: "Créer une organisation" }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Créer l'organisation" }),
        );

        await waitFor(() =>
            expect(toast.warning).toHaveBeenCalledWith(
                "L'e-mail n'a pas pu être envoyé.",
            ),
        );
    });

    it("sends the role and the organization of a new account", async () => {
        const action = vi.fn().mockResolvedValue({ done: "Créé." });
        render(
            <AccountDialog
                {...dialogProps()}
                action={action}
                organizationId="7"
                withRole
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Créer une organisation" }),
        );
        await userEvent.selectOptions(screen.getByLabelText("Rôle"), "reader");
        expect(
            screen.getByText("Consulte seulement, sans rien modifier."),
        ).toBeInTheDocument();
        await userEvent.click(
            screen.getByRole("button", { name: "Créer l'organisation" }),
        );

        await waitFor(() => expect(action).toHaveBeenCalled());
        const formData = action.mock.calls[0][1] as FormData;
        expect(formData.get("organizationId")).toBe("7");
        expect(formData.get("role")).toBe("reader");
    });
});

describe("OrganizationActions", () => {
    it("asks for the exact name before deleting", async () => {
        const remove = vi.fn().mockResolvedValue({
            error: "Saisissez exactement le nom.",
        });
        render(
            <OrganizationActions
                id="7"
                name="Acme"
                userCount={2}
                remove={remove}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Supprimer" }),
        );
        const dialog = screen.getByRole("dialog", {
            name: "Supprimer Acme ?",
        });
        expect(dialog).toHaveTextContent("les 2 comptes");
        const confirm = within(dialog).getByRole("button", {
            name: "Supprimer définitivement",
        });
        const field = within(dialog).getByLabelText(
            "Saisissez « Acme » pour confirmer",
        );

        expect(confirm).toBeDisabled();
        await userEvent.type(field, "acme");
        expect(confirm).toBeDisabled();
        await userEvent.clear(field);
        await userEvent.type(field, "Acme");
        expect(confirm).toBeEnabled();

        await userEvent.click(confirm);

        await waitFor(() => expect(remove).toHaveBeenCalled());
        const formData = remove.mock.calls[0][1] as FormData;
        expect(formData.get("organizationId")).toBe("7");
        expect(formData.get("confirmName")).toBe("Acme");
        // A refusal of the API stays in the dialog.
        expect(await within(dialog).findByRole("alert")).toHaveTextContent(
            "Saisissez exactement le nom.",
        );
    });

    it("renames, starting from the current name", async () => {
        const rename = vi.fn().mockResolvedValue({ done: "Renommée." });
        render(
            <OrganizationActions
                id="7"
                name="Acme"
                userCount={1}
                rename={rename}
            />,
        );

        await userEvent.click(screen.getByRole("button", { name: "Renommer" }));
        const field = screen.getByLabelText("Nom de l'organisation");
        expect(field).toHaveValue("Acme");
        await userEvent.type(field, " Group");
        await userEvent.click(
            screen.getByRole("button", { name: "Enregistrer" }),
        );

        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith("Renommée."),
        );
        expect((rename.mock.calls[0][1] as FormData).get("name")).toBe(
            "Acme Group",
        );
    });
});

describe("AccountTable", () => {
    const [activated, pending] = mockAdminUsers;
    const withoutOrganization: AdminUser = {
        ...activated,
        id: "30",
        email: "test@reglo.test",
        firstName: "Test",
        lastName: "Compte",
        organization: null,
    };

    it("shows the organization, the role and who waits for activation", () => {
        render(
            <AccountTable
                title="Comptes"
                accounts={[activated, pending, withoutOrganization]}
                showOrganization
            />,
        );

        expect(
            screen.getByRole("heading", { name: "Comptes (3)" }),
        ).toBeInTheDocument();
        const rows = screen.getAllByRole("row");
        expect(
            within(rows[1]).getByRole("link", { name: "Atelier Démo" }),
        ).toHaveAttribute("href", "/admin/organisations/1");
        expect(rows[1]).toHaveTextContent("Administrateur");
        expect(rows[2]).toHaveTextContent("Activation en attente");
        expect(rows[3]).toHaveTextContent("Aucune");
    });

    it("changes a role, and goes back when the API refuses", async () => {
        const changeRole = vi
            .fn()
            .mockResolvedValue({ error: "Gardez un administrateur." });
        render(
            <AccountTable
                title="Comptes"
                accounts={[activated]}
                changeRole={changeRole}
            />,
        );
        const row = screen.getAllByRole("row")[1];

        await openRowMenu("Camille Martin");
        await userEvent.click(
            screen.getByRole("menuitemradio", { name: "Lecteur" }),
        );

        expect(changeRole).toHaveBeenCalledWith(
            "11",
            "reader",
            "Camille Martin",
        );
        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                "Gardez un administrateur.",
            ),
        );
        await waitFor(() => expect(row).toHaveTextContent("Administrateur"));
    });

    it("offers a new link only while the account waits for activation", async () => {
        const resend = vi.fn().mockResolvedValue({ done: "Lien envoyé." });
        render(
            <AccountTable
                title="Comptes"
                accounts={[activated, pending]}
                resend={resend}
            />,
        );

        await openRowMenu("Camille Martin");
        expect(
            screen.queryByRole("menuitem", {
                name: "Renvoyer le lien d'activation",
            }),
        ).not.toBeInTheDocument();
        await userEvent.keyboard("{Escape}");

        await openRowMenu("Hugo Bernard");
        await userEvent.click(
            screen.getByRole("menuitem", {
                name: "Renvoyer le lien d'activation",
            }),
        );

        expect(resend).toHaveBeenCalledWith("12", pending.email);
        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith("Lien envoyé."),
        );
    });

    it("removes an account after a confirmation", async () => {
        const remove = vi.fn().mockResolvedValue({ done: "Supprimé." });
        render(
            <AccountTable
                title="Comptes"
                accounts={[pending]}
                remove={remove}
            />,
        );

        await openRowMenu("Hugo Bernard");
        await userEvent.click(
            screen.getByRole("menuitem", { name: "Supprimer le compte" }),
        );
        expect(remove).not.toHaveBeenCalled();
        const dialog = screen.getByRole("dialog", {
            name: "Supprimer le compte de Hugo Bernard ?",
        });
        await userEvent.click(
            within(dialog).getByRole("button", { name: "Supprimer le compte" }),
        );

        expect(remove).toHaveBeenCalledWith("12", "Hugo Bernard", false);
        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith("Supprimé."),
        );
    });

    it("gives no role to an account without organization", async () => {
        render(
            <AccountTable title="Comptes" accounts={[withoutOrganization]} />,
        );

        await openRowMenu("Test Compte");

        expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
    });

    it("for the REGLO team: no role, and no menu on one's own row", async () => {
        const colleague = { ...mockAdminTeam[0], id: "22", firstName: "Noa" };
        const remove = vi.fn().mockResolvedValue({ done: "Supprimé." });
        render(
            <AccountTable
                title="Membres"
                accounts={[mockAdminTeam[0], colleague]}
                team
                currentUserId="21"
                remove={remove}
            />,
        );

        expect(screen.getByText("(vous)")).toBeInTheDocument();
        expect(
            screen.queryByRole("columnheader", { name: "Rôle" }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Actions pour Sacha Equipe" }),
        ).not.toBeInTheDocument();

        await openRowMenu("Noa Equipe");
        expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
        await userEvent.click(
            screen.getByRole("menuitem", { name: "Supprimer le compte" }),
        );
        await userEvent.click(
            within(screen.getByRole("dialog")).getByRole("button", {
                name: "Supprimer le compte",
            }),
        );

        expect(remove).toHaveBeenCalledWith("22", "Noa Equipe", true);
    });
});
