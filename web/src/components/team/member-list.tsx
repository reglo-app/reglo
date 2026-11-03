import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type Member } from "@/lib/api";

export function memberName(
    member: Pick<Member, "firstName" | "lastName" | "email">,
) {
    return (
        [member.firstName, member.lastName].filter(Boolean).join(" ") ||
        member.email
    );
}

/** Members of the organization: name, e-mail, job title, role, status. */
export function MemberList({
    members,
    currentUserId,
}: {
    members: Member[];
    currentUserId: string;
}) {
    return (
        <ul className="divide-y divide-border">
            {members.map((member) => {
                const name = memberName(member);
                return (
                    <li
                        key={member.id}
                        className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
                    >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <UserAvatar user={member} fullName={name} />
                            <div className="flex min-w-0 flex-col">
                                <span className="font-medium wrap-break-word">
                                    {name}
                                    {member.id === currentUserId && (
                                        <span className="font-normal text-ink-muted">
                                            {" "}
                                            (vous)
                                        </span>
                                    )}
                                </span>
                                <span className="text-sm wrap-break-word text-ink-muted">
                                    {member.email}
                                </span>
                            </div>
                        </div>
                        <span className="text-sm text-ink-muted sm:w-48">
                            {member.jobTitle ?? (
                                <span className="sr-only">
                                    Fonction non renseignée
                                </span>
                            )}
                        </span>
                        <div className="flex flex-wrap gap-2 sm:w-56 sm:justify-end">
                            {!member.activated && (
                                <Badge variant="warning">
                                    Activation en attente
                                </Badge>
                            )}
                            <Badge
                                variant={
                                    member.role === "admin"
                                        ? "default"
                                        : "secondary"
                                }
                            >
                                {ROLE_LABELS[member.role]}
                            </Badge>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
