import { UserAvatar } from "@/components/profile/user-avatar";
import {
    MemberRoleSelect,
    RemoveMemberButton,
} from "@/components/team/member-controls";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, type Member } from "@/lib/api";
import { cn } from "@/lib/utils";

export function memberName(
    member: Pick<Member, "firstName" | "lastName" | "email">,
) {
    return (
        [member.firstName, member.lastName].filter(Boolean).join(" ") ||
        member.email
    );
}

/**
 * Members of the organization: name, e-mail, job title, role, status. An
 * administrator also changes roles and removes members (US-16); the API
 * checks it.
 */
export function MemberList({
    members,
    currentUserId,
    canManage = false,
}: {
    members: Member[];
    currentUserId: string;
    canManage?: boolean;
}) {
    return (
        <ul className="divide-y divide-border">
            {members.map((member) => {
                const name = memberName(member);
                const isMe = member.id === currentUserId;
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
                                    {isMe && (
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
                        <div
                            className={cn(
                                "flex flex-wrap items-center gap-2 sm:justify-end",
                                // Same width on every row: the job titles
                                // stay aligned.
                                canManage && "sm:w-72",
                            )}
                        >
                            {!member.activated && (
                                <Badge variant="warning">
                                    Activation en attente
                                </Badge>
                            )}
                            {/* Not for oneself: changing one's own role or
                                leaving is not done here (US-04). */}
                            {canManage && !isMe ? (
                                <>
                                    <RemoveMemberButton
                                        memberId={member.id}
                                        name={name}
                                    />
                                    <MemberRoleSelect
                                        memberId={member.id}
                                        name={name}
                                        role={member.role}
                                    />
                                </>
                            ) : (
                                <Badge
                                    variant={
                                        member.role === "admin"
                                            ? "default"
                                            : "secondary"
                                    }
                                >
                                    {ROLE_LABELS[member.role]}
                                </Badge>
                            )}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
