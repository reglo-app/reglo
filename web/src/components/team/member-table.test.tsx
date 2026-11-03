import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Member } from "@/lib/api";

import { MemberTable, PAGE_SIZE } from "./member-table";

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

const { toast } = await import("sonner");

afterEach(() => {
    vi.clearAllMocks();
});

function member(id: string, overrides: Partial<Member> = {}): Member {
    return {
        id,
        email: `user${id}@acme.test`,
        firstName: `Prénom${id}`,
        lastName: `Nom${id}`,
        jobTitle: null,
        avatarVersion: null,
        role: "member",
        activated: true,
        joinedAt: "2026-09-01T09:00:00+00:00",
        lastSeenAt: "2026-10-01T09:00:00+00:00",
        ...overrides,
    };
}

const CLAIRE = member("1", {
    firstName: "Claire",
    lastName: "Dupont",
    email: "claire@acme.test",
    role: "admin",
    lastSeenAt: "2026-10-16T08:00:00+00:00",
});
const INES = member("2", {
    firstName: "Inès",
    lastName: "Petit",
    email: "ines@acme.test",
    role: "reader",
    joinedAt: "2026-09-10T09:00:00+00:00",
    lastSeenAt: null,
});
const PENDING = member("3", {
    firstName: null,
    lastName: null,
    email: "new@acme.test",
    activated: false,
    joinedAt: null,
    lastSeenAt: null,
});

/** Names of the rows, in their order on screen. */
function rowNames() {
    return screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.querySelector("span.font-medium")?.textContent);
}

describe("MemberTable", () => {
    it("shows each member with role, last activity and join date", () => {
        render(
            <MemberTable members={[CLAIRE, INES, PENDING]} currentUserId="1" />,
        );

        const [, claire, ines, pending] = screen.getAllByRole("row");
        expect(claire).toHaveTextContent("Claire Dupont (vous)");
        expect(claire).toHaveTextContent("claire@acme.test");
        expect(claire).toHaveTextContent("Administrateur");
        expect(claire).toHaveTextContent("16 oct. 2026");
        expect(ines).toHaveTextContent("Lecteur");
        expect(ines).toHaveTextContent("Jamais");
        expect(pending).toHaveTextContent("Activation en attente");
        expect(
            screen.getByRole("heading", { name: "Membres (3)" }),
        ).toBeVisible();
    });

    it("gives no selection nor menu to a member who is not administrator", () => {
        render(<MemberTable members={[CLAIRE, INES]} currentUserId="2" />);

        expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /^Actions pour/ }),
        ).not.toBeInTheDocument();
    });

    it("lets an administrator manage the others, not themself", () => {
        render(
            <MemberTable
                members={[CLAIRE, INES]}
                currentUserId="1"
                canManage
            />,
        );

        expect(
            screen.queryByRole("checkbox", {
                name: "Sélectionner Claire Dupont",
            }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", {
                name: "Actions pour Claire Dupont",
            }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("checkbox", { name: "Sélectionner Inès Petit" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Actions pour Inès Petit" }),
        ).toBeInTheDocument();
    });

    it("searches the names and e-mails, accents ignored", async () => {
        render(
            <MemberTable members={[CLAIRE, INES, PENDING]} currentUserId="1" />,
        );
        const search = screen.getByRole("searchbox", {
            name: "Rechercher un membre",
        });

        await userEvent.type(search, "ines");
        expect(rowNames()).toEqual(["Inès Petit"]);
        expect(screen.getByRole("status")).toHaveTextContent("1 membre trouvé");

        await userEvent.clear(search);
        await userEvent.type(search, "zzz");
        expect(
            screen.getByText("Aucun membre ne correspond à « zzz »."),
        ).toBeInTheDocument();
    });

    it("sorts on the last activity, members never seen last", async () => {
        const older = member("4", {
            firstName: "Old",
            lastName: "Timer",
            lastSeenAt: "2026-08-01T09:00:00+00:00",
        });
        render(
            <MemberTable members={[INES, CLAIRE, older]} currentUserId="1" />,
        );
        const header = screen.getByRole("columnheader", {
            name: "Dernière activité",
        });
        expect(header).toHaveAttribute("aria-sort", "none");

        await userEvent.click(
            within(header).getByRole("button", { name: "Dernière activité" }),
        );
        expect(header).toHaveAttribute("aria-sort", "descending");
        expect(rowNames().map((name) => name?.slice(0, 6))).toEqual([
            "Claire",
            "Old Ti",
            "Inès P",
        ]);

        await userEvent.click(within(header).getByRole("button"));
        expect(header).toHaveAttribute("aria-sort", "ascending");
        expect(rowNames().map((name) => name?.slice(0, 6))).toEqual([
            "Old Ti",
            "Claire",
            "Inès P",
        ]);
    });

    it("shows the members by pages", async () => {
        const many = Array.from({ length: PAGE_SIZE + 2 }, (_, index) =>
            member(String(index + 10)),
        );
        render(<MemberTable members={many} currentUserId="1" />);

        expect(screen.getAllByRole("row")).toHaveLength(PAGE_SIZE + 1);
        const pages = screen.getByRole("navigation", {
            name: "Pages des membres",
        });
        expect(
            within(pages).getByRole("button", { name: "Page 1" }),
        ).toHaveAttribute("aria-current", "page");
        expect(
            within(pages).getByRole("button", { name: "Page précédente" }),
        ).toBeDisabled();

        await userEvent.click(
            within(pages).getByRole("button", { name: "Page 2" }),
        );

        expect(screen.getAllByRole("row")).toHaveLength(3);
        expect(
            within(pages).getByRole("button", { name: "Page suivante" }),
        ).toBeDisabled();
    });

    it("changes a role from the row menu", async () => {
        const changeRole = vi
            .fn()
            .mockResolvedValue({ done: "Inès Petit est maintenant membre." });
        render(
            <MemberTable
                members={[CLAIRE, INES]}
                currentUserId="1"
                canManage
                changeRole={changeRole}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Actions pour Inès Petit" }),
        );
        await userEvent.click(
            await screen.findByRole("menuitemradio", { name: "Membre" }),
        );

        expect(changeRole).toHaveBeenCalledWith("2", "member", "Inès Petit");
        await vi.waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                "Inès Petit est maintenant membre.",
            ),
        );
        expect(screen.getAllByRole("row")[2]).toHaveTextContent("Membre");
    });

    it("goes back to the previous role when refused", async () => {
        const changeRole = vi
            .fn()
            .mockResolvedValue({ error: "Gardez un administrateur." });
        render(
            <MemberTable
                members={[CLAIRE, INES]}
                currentUserId="1"
                canManage
                changeRole={changeRole}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Actions pour Inès Petit" }),
        );
        await userEvent.click(
            await screen.findByRole("menuitemradio", {
                name: "Administrateur",
            }),
        );

        await vi.waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith(
                "Gardez un administrateur.",
            ),
        );
        expect(screen.getAllByRole("row")[2]).toHaveTextContent("Lecteur");
    });

    it("removes the selected members after a confirmation", async () => {
        const remove = vi.fn().mockResolvedValue({ done: "ok" });
        render(
            <MemberTable
                members={[CLAIRE, INES, PENDING]}
                currentUserId="1"
                canManage
                remove={remove}
            />,
        );

        // Select all: only the others, never oneself.
        await userEvent.click(
            screen.getByRole("checkbox", {
                name: "Sélectionner les membres de la page",
            }),
        );
        await userEvent.click(
            screen.getByRole("button", { name: "Retirer (2)" }),
        );
        const dialog = await screen.findByRole("dialog", {
            name: "Retirer 2 membres de l'équipe ?",
        });
        expect(remove).not.toHaveBeenCalled();

        await userEvent.click(
            within(dialog).getByRole("button", { name: "Retirer de l'équipe" }),
        );

        await vi.waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                "2 membres ne font plus partie de l'équipe.",
            ),
        );
        expect(remove).toHaveBeenCalledWith("2", "Inès Petit");
        expect(remove).toHaveBeenCalledWith("3", "new@acme.test");
        expect(remove).not.toHaveBeenCalledWith("1", expect.anything());
    });

    it("removes one member from the row menu", async () => {
        const remove = vi.fn().mockResolvedValue({ done: "ok" });
        render(
            <MemberTable
                members={[CLAIRE, INES]}
                currentUserId="1"
                canManage
                remove={remove}
            />,
        );

        await userEvent.click(
            screen.getByRole("button", { name: "Actions pour Inès Petit" }),
        );
        await userEvent.click(
            await screen.findByRole("menuitem", {
                name: "Retirer de l'équipe",
            }),
        );
        const dialog = await screen.findByRole("dialog", {
            name: "Retirer Inès Petit de l'équipe ?",
        });
        await userEvent.click(
            within(dialog).getByRole("button", { name: "Retirer de l'équipe" }),
        );

        await vi.waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith(
                "Inès Petit ne fait plus partie de l'équipe.",
            ),
        );
        expect(remove).toHaveBeenCalledTimes(1);
    });
});
