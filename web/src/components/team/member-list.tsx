import { UserAvatar } from "@/components/profile/user-avatar";
import {
    MemberRoleSelect,
    RemoveMemberButton,
} from "@/components/team/member-controls";
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
                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            {!member.activated && (
                                <Badge variant="warning">
                                    Activation en attente
                                </Badge>
                            )}
                            {canManage ? (
                                <>
                                    <MemberRoleSelect
                                        memberId={member.id}
                                        name={name}
                                        role={member.role}
                                    />
                                    {/* Leaving oneself is the erasure of
                                        one's own account (US-04). */}
                                    {isMe ? (
                                        <span className="hidden w-10 sm:block" />
                                    ) : (
                                        <RemoveMemberButton
                                            memberId={member.id}
                                            name={name}
                                        />
                                    )}
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
