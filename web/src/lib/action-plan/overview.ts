import { personName } from "@/lib/action-plan/labels";
import type {
    Action,
    ActionsOverview,
    ActionSummary,
    DashboardSummary,
} from "@/lib/api/types";

function toSummary(action: Action): ActionSummary {
    return {
        id: action.id,
        title: action.title,
        domain: action.domain,
        ownerName: action.assignee ? personName(action.assignee) : "",
        dueDate: action.dueDate,
        status: action.status,
    };
}

/**
 * The alerts and next actions of the dashboard from the real action plan
 * (US-10). Alerts on documents and training will join them with their own
 * cards. The on-time rate is not computed yet: hidden.
 */
export function withActionsOverview(
    summary: DashboardSummary,
    overview: ActionsOverview,
): DashboardSummary {
    return {
        ...summary,
        generatedAt: overview.today,
        alerts: overview.urgent.map((action) => ({
            id: `action-${action.id}`,
            kind: "action_due",
            title: action.title,
            domain: action.domain,
            dueDate: action.dueDate,
        })),
        upcomingActions: overview.upcoming.map(toSummary),
        actionsOnTimeRate: null,
    };
}
