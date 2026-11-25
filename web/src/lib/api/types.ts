// Shapes of the data returned by the REGLO API (Symfony / API Platform).
// Keep them in sync with the API resources when the endpoints are built.

import type { DomainKey } from "@/lib/domains";

export type RoleKey = "admin" | "member" | "reader";

export const ROLE_LABELS: Record<RoleKey, string> = {
    admin: "Administrateur",
    member: "Membre",
    reader: "Lecteur",
};

/** Shown instead of a role for the REGLO team, who belong to no client. */
export const PLATFORM_ROLE_LABEL = "Équipe Réglo";

/** What each role can do (US-16), shown where a role is chosen. */
export const ROLE_DESCRIPTIONS: Record<RoleKey, string> = {
    admin: "Gère l'équipe, les rôles et toutes les données.",
    member: "Remplit le diagnostic, gère les actions et les justificatifs.",
    reader: "Consulte seulement, sans rien modifier.",
};

/** Roles in the order they are offered: the usual choice first. */
export const ROLE_KEYS: RoleKey[] = ["member", "reader", "admin"];

/**
 * Whether the role can change the data of the organization. Only hides
 * buttons: the API refuses the writes of a reader anyway (rule 2).
 */
export function canEdit(role: RoleKey): boolean {
    return role !== "reader";
}

export type Organization = {
    id: string;
    name: string;
};

/**
 * `GET /api/auth/me`: the signed-in user and their organization (US-02).
 * Names and organization are null until organization onboarding (US-01).
 */
export type CurrentUser = {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    /** e.g. "Responsable QHSE", set in "Mon profil". */
    jobTitle: string | null;
    /** Changes with each new profile photo; null without photo. */
    avatarVersion: string | null;
    role: RoleKey;
    /** REGLO team: the back office opens for them. The API checks it. */
    platformAdmin: boolean;
    organization: Organization | null;
};

/** Score of one QHSE domain, from 0 to 100 (DATA-01 / US-06). */
export type DomainScore = {
    domain: DomainKey;
    score: number;
    /** Score of the previous diagnostic, if any. */
    previousScore: number | null;
};

export type AlertKind =
    "action_due" | "document_expiring" | "training_expiring";

/** Something late or about to expire (home page "Alertes" block). */
export type DashboardAlert = {
    id: string;
    kind: AlertKind;
    title: string;
    domain: DomainKey;
    /** ISO 8601 date: deadline or expiry date. */
    dueDate: string;
};

/** Steps of an action, in order (US-09). */
export const ACTION_STATUSES = [
    "todo",
    "in_progress",
    "in_review",
    "done",
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_TYPES = [
    "corrective",
    "preventive",
    "improvement",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

/** Someone linked to an action; null in its place once they left. */
export type ActionPerson = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
};

/** `GET /api/actions`: one action of the action plan (US-09). */
export type Action = {
    id: string;
    title: string;
    description: string;
    domain: DomainKey;
    type: ActionType;
    status: ActionStatus;
    /** Calendar date, "YYYY-MM-DD". */
    dueDate: string;
    /** Unfinished and past its due date. */
    isOverdue: boolean;
    /** Unfinished and due in 7 days or less. */
    isDueSoon: boolean;
    /** Null once the assignee left the organization. */
    assignee: ActionPerson | null;
    createdBy: ActionPerson | null;
    createdAt: string;
    updatedAt: string;
};

/** A status change; the first one (from null) is the creation. */
export type ActionStatusChange = {
    from: ActionStatus | null;
    to: ActionStatus;
    by: ActionPerson | null;
    /** ISO 8601 date. */
    at: string;
};

/**
 * `GET /api/actions/{id}`: the action with its history, oldest first, and
 * its evidence, latest first (US-12).
 */
export type ActionDetail = Action & {
    history: ActionStatusChange[];
    documents: EvidenceDocument[];
};

/** `GET /api/actions/overview`: the action plan on the dashboard (US-10). */
export type ActionsOverview = {
    /** "YYYY-MM-DD" in France, the day the due dates are compared with. */
    today: string;
    counts: Record<ActionStatus | "overdue" | "dueSoon", number>;
    /** Late and soon due actions, most urgent first (at most 5). */
    urgent: Action[];
    /** Next unfinished actions that are not late, soonest first (at most 5). */
    upcoming: Action[];
};

/** Action of the action plan (US-09). */
export type ActionSummary = {
    id: string;
    title: string;
    domain: DomainKey;
    ownerName: string;
    /** ISO 8601 date. */
    dueDate: string;
    status: ActionStatus;
};

/** An action or a question of the diagnostic a document proves (US-12). */
export type DocumentLink = { id: string; title: string };

/** `GET /api/documents`: evidence kept by the organization (US-11). */
export type EvidenceDocument = {
    id: string;
    /** Name of the file when it was uploaded. */
    name: string;
    /** The type found in the content of the file. */
    mimeType: string;
    /** In bytes. */
    size: number;
    domain: DomainKey | null;
    /** Null once the author left the organization. */
    uploadedBy: ActionPerson | null;
    /** ISO 8601 date. */
    createdAt: string;
    /** Actions it proves (US-12). */
    actions: DocumentLink[];
    /** Questions of the diagnostic it proves, for the organization. */
    questions: { id: string; label: string }[];
};

export const DOCUMENT_ACCESS_KINDS = ["download", "view"] as const;
export type DocumentAccessKind = (typeof DOCUMENT_ACCESS_KINDS)[number];

/** `GET /api/documents/{id}/accesses`: who opened it (US-12), admins only. */
export type DocumentAccess = {
    /** Null once the member left the organization. */
    by: ActionPerson | null;
    kind: DocumentAccessKind;
    /** ISO 8601 date. */
    at: string;
};

/** Regulatory news item (US-15). */
export type NewsSummary = {
    id: string;
    title: string;
    domain: DomainKey;
    /** ISO 8601 date. */
    publishedAt: string;
    /** Cover image URL, or null (a domain-coloured cover is shown). */
    imageUrl: string | null;
};

/** `GET /api/news/{id}`: one regulatory news article. */
export type NewsArticle = NewsSummary & {
    /** Short summary shown under the title. */
    summary: string;
    /** Body, one string per paragraph (plain text). */
    paragraphs: string[];
    /** Where the text comes from (official journal, ministry…). */
    sourceName: string;
    sourceUrl: string | null;
};

/** Score of one diagnostic theme of a pillar (DATA-01). */
export type ThemeScore = {
    id: string;
    label: string;
    score: number;
};

/** Evidence document close to its expiry date (US-11). */
export type ExpiringDocument = {
    id: string;
    title: string;
    /** ISO 8601 expiry date. */
    dueDate: string;
};

/** `GET /api/domains/{domain}`: everything a QHSE pillar page shows. */
export type DomainDetail = {
    /** ISO 8601 date the data was computed: "today" for due dates. */
    generatedAt: string;
    domain: DomainKey;
    /** Pillar score from 0 to 100, or null if no diagnostic yet. */
    score: number | null;
    previousScore: number | null;
    /** One entry per diagnostic theme of the pillar. */
    themes: ThemeScore[];
    /** Open actions of the pillar, soonest first (at most 5). */
    actions: ActionSummary[];
    /** Documents expiring in the next 60 days or already expired. */
    expiringDocuments: ExpiringDocument[];
    /** Latest news of the pillar (at most 3). */
    latestNews: NewsSummary[];
};

/** `GET /api/dashboard`: everything the home page shows. */
export type DashboardSummary = {
    /** ISO 8601 date the summary was computed: "today" for due dates. */
    generatedAt: string;
    /** Global score from 0 to 100, or null if no diagnostic yet. */
    globalScore: number | null;
    /** Global score of the previous diagnostic, if any. */
    previousGlobalScore: number | null;
    domains: DomainScore[];
    /** ISO 8601 date of the last diagnostic, or null if none yet. */
    lastDiagnosticAt: string | null;
    /** At most 5, most urgent first. */
    alerts: DashboardAlert[];
    /** Next open actions, soonest first (at most 5). */
    upcomingActions: ActionSummary[];
    /** Share of actions closed on time over the last 12 months, 0 to 100. */
    actionsOnTimeRate: number | null;
    /** Latest news relevant to the organization (at most 3). */
    latestNews: NewsSummary[];
};

/** `GET /api/admin/organizations`: a client, for the REGLO team. */
export type AdminOrganization = {
    id: string;
    name: string;
    /** ISO 8601 date. */
    createdAt: string;
    userCount: number;
    /** Accounts waiting for their owner to choose a password. */
    pendingCount: number;
};

/** An account in the back office: what is needed to manage an access. */
export type AdminUser = {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: RoleKey;
    /** False until the person has chosen a password. */
    activated: boolean;
    /** ISO 8601 date the account was activated; null before. */
    joinedAt: string | null;
    /** ISO 8601 date of the last activity (to 5 minutes); null if never. */
    lastSeenAt: string | null;
    /** null for an account outside any client. */
    organization: Organization | null;
};

/** `GET /api/admin/organizations/{id}`. */
export type AdminOrganizationDetail = {
    id: string;
    name: string;
    /** ISO 8601 date. */
    createdAt: string;
    users: AdminUser[];
};

/** `GET /api/users`: a member of the organization of the signed-in user. */
export type Member = {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    jobTitle: string | null;
    avatarVersion: string | null;
    role: RoleKey;
    /** False until the member has chosen a password. */
    activated: boolean;
    /** ISO 8601 date the account was activated; null before. */
    joinedAt: string | null;
    /** ISO 8601 date of the last activity (to 5 minutes); null if never. */
    lastSeenAt: string | null;
};

/**
 * `GET /api/invitations` (administrators only): a collaborator invited and
 * not joined yet (US-03).
 */
export type Invitation = {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    /** Name of the administrator who invited; null once they left. */
    invitedBy: string | null;
    /** Given to the account once the invitation is accepted. */
    role: RoleKey;
    /** ISO 8601 date of the last sending. */
    sentAt: string;
    expiresAt: string;
    /** The link no longer works: the invitation must be sent again. */
    expired: boolean;
};

/** An answer choice of a question (`single_choice`, `multi_choice`). */
export type QuestionOption = { id: string; label: string; points?: number };

type QuestionBase = {
    id: string;
    label: string;
    /** Example or precision shown under the question. */
    help?: string;
    /** Legal or normative reference, e.g. "Code du travail, art. R4121-1". */
    reference?: string;
    /** True unless false: needed before submitting. */
    mandatory?: boolean;
    /** "Non concerné" is allowed. */
    allow_na?: boolean;
    /** Without a document (US-12), a good answer is capped at 50. */
    requires_proof?: boolean;
};

/**
 * A question of the diagnostic, in the format of the data service. The
 * answer value depends on the type: "yes" / "no" / "partial", the index of
 * the level, an option id, a list of option ids, a text.
 */
export type Question =
    | (QuestionBase & { type: "yes_no" })
    | (QuestionBase & { type: "scale"; levels: string[] })
    | (QuestionBase & {
          type: "single_choice" | "multi_choice";
          options: QuestionOption[];
      })
    | (QuestionBase & { type: "text" });

export type QuestionnaireTheme = {
    id: string;
    label: string;
    questions: Question[];
};

export type QuestionnairePillar = {
    id: DomainKey;
    label: string;
    themes: QuestionnaireTheme[];
};

/** `GET /api/questionnaire`: the QHSE questionnaire (US-05). */
export type Questionnaire = {
    version: string;
    pillars: QuestionnairePillar[];
};

export type AnswerValue = string | number | string[];

export type DiagnosticAnswer = {
    value: AnswerValue | null;
    notApplicable: boolean;
};

export type Diagnostic = {
    id: string;
    status: "draft" | "submitted";
    questionnaireVersion: string;
    startedAt: string;
    updatedAt: string;
    submittedAt: string | null;
    /** By question id. */
    answers: Record<string, DiagnosticAnswer>;
};

/** A question to improve first: the points it would add to the global score. */
export type ScoreGap = {
    question_id: string;
    label: string;
    pillar: DomainKey;
    theme: string;
    score: number;
    potential_points: number;
    /** Capped because the proof (document) is missing. */
    capped_for_proof?: boolean;
};

/** Score computed by the data service (0 to 100, one decimal; null: all not applicable). */
export type DiagnosticScore = {
    global: number | null;
    /** e.g. "Maîtrisé". */
    maturity: string | null;
    pillars: Partial<Record<DomainKey, number | null>>;
    /** By theme id. */
    themes: Record<string, number | null>;
    /** Share of the scored questions actually answered (0 to 1). */
    coverage: number | null;
    /** At most 3, biggest gain first. */
    gaps: ScoreGap[];
    algoVersion: string | null;
};

/** `GET /api/diagnostics/latest/result` (null when never scored), US-06. */
export type DiagnosticResult = {
    diagnosticId: string;
    submittedAt: string;
    questionnaireVersion: string;
    score: DiagnosticScore;
    /** The diagnostic before, for the trend. */
    previous: {
        submittedAt: string;
        global: number | null;
        pillars: Partial<Record<DomainKey, number | null>>;
    } | null;
};

/** `GET /api/diagnostics`: one submitted diagnostic of the history (US-07). */
export type DiagnosticHistoryEntry = {
    id: string;
    submittedAt: string;
    questionnaireVersion: string;
    global: number | null;
    maturity: string | null;
    pillars: Partial<Record<DomainKey, number | null>>;
};

/** `GET /api/diagnostics/current`: the shared draft of the organization. */
export type CurrentDiagnostic = {
    draft: Diagnostic | null;
    /** ISO 8601 date the last diagnostic was submitted; null if never. */
    lastSubmittedAt: string | null;
};

export type TrainingLevel = "beginner" | "intermediate" | "advanced";

/** `GET /api/trainings`: a course of the catalog with the user's progress (US-13). */
export type TrainingSummary = {
    id: string;
    title: string;
    summary: string;
    domain: DomainKey;
    level: TrainingLevel;
    /** Paid courses show their description only (no payment in the MVP). */
    free: boolean;
    durationMinutes: number;
    lessonCount: number;
    completedCount: number;
};

export type TrainingLessonType = "text" | "video" | "pdf";

/** A lesson; the content fields are only sent for free courses. */
export type TrainingLesson = {
    id: string;
    title: string;
    type: TrainingLessonType;
    durationMinutes: number;
    completed: boolean;
    paragraphs?: string[];
    keyPoints?: string[];
    /** Privacy-friendly embed (youtube-nocookie, Vimeo). */
    videoUrl?: string | null;
    /** Text of the video (RGAA). */
    transcript?: string[];
    pdfUrl?: string | null;
};

/** `GET /api/trainings/{id}`. */
export type TrainingDetail = TrainingSummary & { lessons: TrainingLesson[] };

/** Answer of `PUT|DELETE /api/me/trainings/{course}/lessons/{lesson}`. */
export type TrainingProgress = {
    completedCount: number;
    lessonCount: number;
};
