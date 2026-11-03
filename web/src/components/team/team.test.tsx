import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Invitation, Member } from "@/lib/api";

import { AcceptInvitationForm } from "./accept-invitation-form";
import { InvitationList } from "./invitation-list";
import { InviteDialog, type InviteDialogProps } from "./invite-dialog";
import { MemberRoleSelect, RemoveMemberButton } from "./member-controls";
import { MemberList } from "./member-list";

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

const { toast } = await import("sonner");

const MEMBERS: Member[] = [
    {
        id: "1",
        email: "claire@acme.test",
        firstName: "Claire",
        lastName: "Dupont",
        jobTitle: "Responsable QHSE",
        avatarVersion: null,
        role: "admin",
        activated: true,
    },
    {
        id: "2",
        email: "new@acme.test",
        firstName: null,
        lastName: null,
        jobTitle: null,
        avatarVersion: null,
        role: "member",
        activated: false,
    },
];

const INVITATION: Invitation = {
    id: "9",
    email: "paul@acme.test",
    firstName: "Paul",
    lastName: null,
    role: "member",
    invitedBy: "Claire Dupont",
    sentAt: "2026-10-14T09:30:00.000Z",
    expiresAt: "2026-10-21T09:30:00.000Z",
    expired: false,
};

describe("MemberList", () => {
    it("shows each member with their role, status and the current user", () => {
        render(<MemberList members={MEMBERS} currentUserId="1" />);

        const [claire, invited] = screen.getAllByRole("listitem");
        expect(claire).toHaveTextContent("Claire Dupont (vous)");
        expect(claire).toHaveTextContent("Responsable QHSE");
        expect(claire).toHaveTextContent("Administrateur");
        // Without name, the e-mail is the name.
        expect(within(invited).getAllByText("new@acme.test")).toHaveLength(2);
        expect(invited).toHaveTextContent("Membre");
        expect(invited).toHaveTextContent("Activation en attente");
        expect(invited).toHaveTextContent("Fonction non renseignée");
        // Not an administrator: no control
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /^Retirer/ }),
        ).not.toBeInTheDocument();
    });

    it("lets an administrator choose roles and remove the others", () => {
        render(<MemberList members={MEMBERS} currentUserId="1" canManage />);

        expect(screen.getByLabelText("Rôle de Claire Dupont")).toHaveValue(
            "admin",
        );
        expect(screen.getByLabelText("Rôle de new@acme.test")).toHaveValue(
            "member",
        );
        expect(
            screen.getByRole("button", {
                name: "Retirer new@acme.test de l'équipe",
            }),
        ).toBeInTheDocument();
        // Leaving oneself is not done here (US-04).
        expect(
            screen.queryByRole("button", {
                name: "Retirer Claire Dupont de l'équipe",
            }),
        ).not.toBeInTheDocument();
    });
});

describe("MemberRoleSelect", () => {
    it("saves the chosen role", async () => {
        const change = vi
            .fn()
            .mockResolvedValue({ done: "Paul est maintenant lecteur." });
        render(
            <MemberRoleSelect
                memberId="4"
                name="Paul"
                role="member"
                change={change}
            />,
        );

        await userEvent.selectOptions(
            screen.getByLabelText("Rôle de Paul"),
            "reader",
        );

        await vi.waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                "Paul est maintenant lecteur.",
            ),
        );
        expect(change).toHaveBeenCalledWith("4", "reader", "Paul");
        expect(screen.getByLabelText("Rôle de Paul")).toHaveValue("reader");
    });

    it("goes back to the previous role when refused", async () => {
        const change = vi
            .fn()
            .mockResolvedValue({ error: "Gardez un administrateur." });
        render(
            <MemberRoleSelect
                memberId="1"
                name="Claire"
                role="admin"
                change={change}
            />,
        );

        await userEvent.selectOptions(
            screen.getByLabelText("Rôle de Claire"),
            "member",
        );

        await vi.waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                "Gardez un administrateur.",
            ),
        );
        expect(screen.getByLabelText("Rôle de Claire")).toHaveValue("admin");
    });
});

describe("RemoveMemberButton", () => {
    it("removes only after the confirmation", async () => {
        const remove = vi.fn().mockResolvedValue({
            done: "Paul ne fait plus partie de l'équipe.",
        });
        render(<RemoveMemberButton memberId="4" name="Paul" remove={remove} />);

        await userEvent.click(
            screen.getByRole("button", { name: "Retirer Paul de l'équipe" }),
        );
        const dialog = await screen.findByRole("dialog", {
            name: "Retirer Paul de l'équipe ?",
        });
        expect(remove).not.toHaveBeenCalled();

        await userEvent.click(
            within(dialog).getByRole("button", {
                name: "Retirer de l'équipe",
            }),
        );

        await vi.waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                "Paul ne fait plus partie de l'équipe.",
            ),
        );
        expect(remove).toHaveBeenCalledWith("4", "Paul");
        await vi.waitFor(() =>
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
        );
    });

    it("keeps the member when cancelled", async () => {
        const remove = vi.fn();
        render(<RemoveMemberButton memberId="4" name="Paul" remove={remove} />);

        await userEvent.click(
            screen.getByRole("button", { name: "Retirer Paul de l'équipe" }),
        );
        await userEvent.click(
            await screen.findByRole("button", { name: "Annuler" }),
        );

        expect(remove).not.toHaveBeenCalled();
        await vi.waitFor(() =>
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
        );
    });
});

describe("InvitationList", () => {
    it("says when there is no pending invitation", () => {
        render(<InvitationList invitations={[]} />);

        expect(
            screen.getByText("Aucune invitation en attente."),
        ).toBeInTheDocument();
    });

    it("shows who invited, when, and whether the link still works", () => {
        render(
            <InvitationList
                invitations={[
                    INVITATION,
                    {
                        ...INVITATION,
                        id: "10",
                        email: "old@acme.test",
                        expired: true,
                    },
                ]}
            />,
        );

        const [pending, expired] = screen.getAllByRole("listitem");
        expect(pending).toHaveTextContent(
            "Paul · Invitée par Claire Dupont, le 14 oct. 2026",
        );
        expect(pending).toHaveTextContent("Valable jusqu'au 21 oct. 2026");
        expect(expired).toHaveTextContent("Expirée");
    });

    it("sends again and cancels, with the address in the button names", async () => {
        const resend = vi.fn().mockResolvedValue({
            done: "Invitation renvoyée à paul@acme.test.",
        });
        const cancel = vi.fn().mockResolvedValue({ error: "Impossible." });
        render(
            <InvitationList
                invitations={[INVITATION]}
                resend={resend}
                cancel={cancel}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", {
                name: "Renvoyer l'invitation à paul@acme.test",
            }),
        );
        await vi.waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                "Invitation renvoyée à paul@acme.test.",
            ),
        );
        expect(resend).toHaveBeenCalledWith("9", "paul@acme.test");

        await userEvent.click(
            screen.getByRole("button", {
                name: "Annuler l'invitation de paul@acme.test",
            }),
        );
        await vi.waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith("Impossible."),
        );
    });
});

describe("InviteDialog", () => {
    async function openDialog(action: InviteDialogProps["action"]) {
        render(<InviteDialog organizationName="Acme" action={action} />);
        await userEvent.click(
            screen.getByRole("button", { name: "Inviter un collaborateur" }),
        );
        return screen.findByRole("dialog", {
            name: "Inviter un collaborateur",
        });
    }

    it("sends the address and names, then closes with a message", async () => {
        const action = vi.fn().mockResolvedValue({ sentTo: "paul@acme.test" });
        const dialog = await openDialog(action);

        expect(dialog).toHaveTextContent("rejoindre Acme");
        const role = within(dialog).getByLabelText("Rôle");
        expect(role).toHaveValue("member");
        expect(role).toHaveAccessibleDescription(
            "Remplit le diagnostic, gère les actions et les justificatifs.",
        );
        await userEvent.selectOptions(role, "reader");
        expect(role).toHaveAccessibleDescription(
            "Consulte seulement, sans rien modifier.",
        );
        await userEvent.type(
            within(dialog).getByLabelText("Adresse e-mail"),
            "paul@acme.test",
        );
        await userEvent.type(within(dialog).getByLabelText("Prénom"), "Paul");
        await userEvent.click(
            within(dialog).getByRole("button", {
                name: "Envoyer l'invitation",
            }),
        );

        await vi.waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                "Invitation envoyée à paul@acme.test.",
            ),
        );
        expect(toast.success).toHaveBeenCalledTimes(1);
        expect(Object.fromEntries(action.mock.calls[0][1] as FormData)).toEqual(
            {
                email: "paul@acme.test",
                firstName: "Paul",
                lastName: "",
                role: "reader",
            },
        );
        await vi.waitFor(() =>
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
        );
    });

    it("keeps the refused address in the field, marked invalid", async () => {
        const action = vi.fn().mockResolvedValue({
            error: "Cette adresse e-mail ne peut pas être invitée.",
            fieldErrors: {
                email: "Cette adresse e-mail ne peut pas être invitée.",
            },
        });
        const dialog = await openDialog(action);

        await userEvent.type(
            within(dialog).getByLabelText("Adresse e-mail"),
            "taken@acme.test",
        );
        await userEvent.click(
            within(dialog).getByRole("button", {
                name: "Envoyer l'invitation",
            }),
        );

        expect(await within(dialog).findByRole("alert")).toHaveTextContent(
            "ne peut pas être invitée",
        );
        const email = within(dialog).getByLabelText("Adresse e-mail");
        expect(email).toHaveValue("taken@acme.test");
        expect(email).toHaveAttribute("aria-invalid", "true");
        expect(within(dialog).getByLabelText("Prénom")).not.toHaveAttribute(
            "aria-invalid",
        );
    });
});

describe("AcceptInvitationForm", () => {
    const invitation = {
        email: "paul@acme.test",
        firstName: "Paul",
        lastName: null,
    };

    it("prefills the names and sends the token", async () => {
        const action = vi.fn().mockResolvedValue({});
        render(
            <AcceptInvitationForm
                token="abc"
                invitation={invitation}
                action={action}
            />,
        );

        expect(screen.getByLabelText("Prénom")).toHaveValue("Paul");
        expect(screen.getByLabelText("Mot de passe")).toHaveAttribute(
            "autocomplete",
            "new-password",
        );
        await userEvent.type(screen.getByLabelText("Nom"), "Martin");
        await userEvent.click(
            screen.getByRole("button", { name: "Rejoindre l'équipe" }),
        );

        await vi.waitFor(() => expect(action).toHaveBeenCalled());
        const sent = action.mock.calls[0][1] as FormData;
        expect(sent.get("token")).toBe("abc");
        expect(sent.get("firstName")).toBe("Paul");
        expect(sent.get("lastName")).toBe("Martin");
    });

    it("marks the refused field", async () => {
        const action = vi.fn().mockResolvedValue({
            error: "Les deux mots de passe ne sont pas identiques.",
            invalidFields: ["confirmation"],
        });
        render(
            <AcceptInvitationForm
                token="abc"
                invitation={invitation}
                action={action}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Rejoindre l'équipe" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "pas identiques",
        );
        expect(
            screen.getByLabelText("Confirmez le mot de passe"),
        ).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByLabelText("Prénom")).toHaveValue("Paul");
    });

    it("replaces the form when the link expired", async () => {
        const action = vi.fn().mockResolvedValue({
            error: "Cette invitation a expiré.",
            linkExpired: true,
        });
        render(
            <AcceptInvitationForm
                token="abc"
                invitation={invitation}
                action={action}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Rejoindre l'équipe" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Cette invitation a expiré.",
        );
        expect(
            screen.queryByRole("button", { name: "Rejoindre l'équipe" }),
        ).not.toBeInTheDocument();
    });
});
