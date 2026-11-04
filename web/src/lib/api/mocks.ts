// Fictitious data used while the API endpoints do not exist yet.
// News covers are generated placeholders in public/mock/news/.
// No real person or company: names are invented.

import type { DomainKey } from "@/lib/domains";

import type {
    ActionSummary,
    CurrentDiagnostic,
    DiagnosticResult,
    CurrentUser,
    DashboardSummary,
    DomainDetail,
    ExpiringDocument,
    Invitation,
    Member,
    NewsArticle,
    Questionnaire,
    ThemeScore,
} from "./types";

export const mockCurrentUser: CurrentUser = {
    id: "0192f0c4-7a3e-7c3a-9b1e-5d2a1c000001",
    email: "camille.martin@atelier-demo.test",
    firstName: "Camille",
    lastName: "Martin",
    jobTitle: "Responsable QHSE",
    avatarVersion: null,
    role: "admin",
    organization: {
        id: "0192f0c4-7a3e-7c3a-9b1e-5d2a1c0000a1",
        name: "Atelier Démo",
    },
};

/** Members of "Atelier Démo": enough of them for two pages of the table. */
export const mockMembers: Member[] = [
    {
        id: mockCurrentUser.id,
        email: mockCurrentUser.email,
        firstName: mockCurrentUser.firstName,
        lastName: mockCurrentUser.lastName,
        jobTitle: mockCurrentUser.jobTitle,
        avatarVersion: null,
        role: "admin",
        activated: true,
        joinedAt: "2026-09-01T08:00:00.000Z",
        lastSeenAt: "2026-10-16T07:55:00.000Z",
    },
    ...(
        [
            [
                "Hugo",
                "Bernard",
                "Chef d'atelier",
                "member",
                "2026-09-03",
                "2026-10-15",
            ],
            ["Inès", "Petit", null, "reader", "2026-09-10", "2026-10-02"],
            [
                "Julien",
                "Roux",
                "Technicien",
                "member",
                "2026-09-12",
                "2026-10-14",
            ],
            [
                "Karima",
                "Benali",
                "Assistante RH",
                "member",
                "2026-09-15",
                "2026-10-11",
            ],
            [
                "Louis",
                "Garnier",
                "Directeur",
                "admin",
                "2026-09-02",
                "2026-10-09",
            ],
            ["Manon", "Faure", null, "reader", "2026-09-20", null],
            [
                "Nathan",
                "Lefebvre",
                "Magasinier",
                "member",
                "2026-09-22",
                "2026-09-30",
            ],
            [
                "Océane",
                "Mercier",
                "Qualiticienne",
                "member",
                "2026-09-25",
                "2026-10-16",
            ],
            ["Pierre", "Dupuis", null, "reader", "2026-10-01", "2026-10-05"],
            [
                "Rose",
                "Lambert",
                "Infirmière",
                "member",
                "2026-10-03",
                "2026-10-13",
            ],
            ["Samuel", "Girard", null, "member", null, null],
        ] as const
    ).map(([firstName, lastName, jobTitle, role, joined, seen], index) => ({
        id: `0192f0c4-7a3e-7c3a-9b1e-5d2a1c0001${String(index).padStart(2, "0")}`,
        email: `${firstName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${lastName.toLowerCase()}@atelier-demo.test`,
        firstName,
        lastName,
        jobTitle,
        avatarVersion: null,
        role,
        activated: joined !== null,
        joinedAt: joined && `${joined}T09:00:00.000Z`,
        lastSeenAt: seen && `${seen}T16:30:00.000Z`,
    })),
];

export const mockInvitations: Invitation[] = [
    {
        id: "1",
        email: "lucas.moreau@atelier-demo.test",
        firstName: "Lucas",
        lastName: "Moreau",
        role: "member",
        invitedBy: "Camille Martin",
        sentAt: "2026-10-14T09:30:00.000Z",
        expiresAt: "2026-10-21T09:30:00.000Z",
        expired: false,
    },
    {
        id: "2",
        email: "nora.lambert@atelier-demo.test",
        firstName: null,
        lastName: null,
        role: "reader",
        invitedBy: "Camille Martin",
        sentAt: "2026-10-01T14:00:00.000Z",
        expiresAt: "2026-10-08T14:00:00.000Z",
        expired: true,
    },
];

export const mockDashboardSummary: DashboardSummary = {
    generatedAt: "2026-10-16T08:00:00.000Z",
    globalScore: 64,
    previousGlobalScore: 59,
    domains: [
        { domain: "quality", score: 72, previousScore: 65 },
        { domain: "hygiene", score: 58, previousScore: 60 },
        { domain: "safety", score: 49, previousScore: null },
        { domain: "environment", score: 77, previousScore: 70 },
    ],
    lastDiagnosticAt: "2026-10-01T09:00:00.000Z",
    alerts: [
        {
            id: "alert-1",
            kind: "action_overdue",
            title: "Mettre à jour le DUERP",
            domain: "safety",
            dueDate: "2026-10-10T00:00:00.000Z",
        },
        {
            id: "alert-2",
            kind: "training_expiring",
            title: "Habilitation électrique de L. Bernard",
            domain: "safety",
            dueDate: "2026-10-28T00:00:00.000Z",
        },
        {
            id: "alert-3",
            kind: "document_expiring",
            title: "Contrat d'enlèvement des déchets",
            domain: "environment",
            dueDate: "2026-11-05T00:00:00.000Z",
        },
        {
            id: "alert-4",
            kind: "action_overdue",
            title: "Afficher le protocole de nettoyage des vestiaires",
            domain: "hygiene",
            dueDate: "2026-10-14T00:00:00.000Z",
        },
    ],
    upcomingActions: [
        {
            id: "action-1",
            title: "Planifier l'audit interne ISO 9001",
            domain: "quality",
            ownerName: "Camille Martin",
            dueDate: "2026-10-20T00:00:00.000Z",
            status: "in_progress",
        },
        {
            id: "action-2",
            title: "Vérifier les extincteurs de l'atelier",
            domain: "safety",
            ownerName: "Léo Bernard",
            dueDate: "2026-10-24T00:00:00.000Z",
            status: "todo",
        },
        {
            id: "action-3",
            title: "Installer un bac de tri pour les métaux",
            domain: "environment",
            ownerName: "Inès Moreau",
            dueDate: "2026-10-31T00:00:00.000Z",
            status: "todo",
        },
        {
            id: "action-4",
            title: "Former l'équipe aux gestes et postures",
            domain: "hygiene",
            ownerName: "Camille Martin",
            dueDate: "2026-11-12T00:00:00.000Z",
            status: "todo",
        },
    ],
    actionsOnTimeRate: 78,
    latestNews: [
        {
            id: "news-1",
            title: "Vérifications périodiques des équipements de travail : nouvel arrêté",
            domain: "safety",
            publishedAt: "2026-10-12T00:00:00.000Z",
            imageUrl: "/mock/news/safety.jpg",
        },
        {
            id: "news-2",
            title: "Tri à la source des biodéchets : rappel des obligations",
            domain: "environment",
            publishedAt: "2026-10-08T00:00:00.000Z",
            imageUrl: "/mock/news/environment.jpg",
        },
        {
            id: "news-3",
            title: "Réclamations clients : délais de réponse recommandés",
            domain: "quality",
            publishedAt: "2026-10-02T00:00:00.000Z",
            imageUrl: "/mock/news/quality.jpg",
        },
    ],
};

/** Full articles behind `latestNews` (fictitious summaries, not legal advice). */
export const mockNewsArticles: NewsArticle[] = [
    {
        ...mockDashboardSummary.latestNews[0],
        summary:
            "Un nouvel arrêté précise la périodicité des vérifications des équipements de levage et des installations électriques.",
        paragraphs: [
            "Les équipements de travail soumis à vérification périodique doivent être contrôlés selon une fréquence fixée par arrêté. Le nouveau texte regroupe ces fréquences dans un seul tableau, par type d'équipement.",
            "Pour les appareils de levage, la vérification reste semestrielle. Pour les installations électriques, elle devient annuelle quel que soit l'effectif, avec un rapport à conserver dans le registre de sécurité.",
            "À faire : vérifier que chaque équipement concerné a une date de prochaine vérification dans REGLO et joindre le dernier rapport en justificatif.",
        ],
        sourceName: "Journal officiel",
        sourceUrl: null,
    },
    {
        ...mockDashboardSummary.latestNews[1],
        summary:
            "Toutes les entreprises qui produisent des biodéchets doivent les trier à la source et les faire valoriser.",
        paragraphs: [
            "Depuis le 1er janvier 2024, le tri à la source des biodéchets est obligatoire pour tous les producteurs, quelle que soit la quantité produite.",
            "Les biodéchets doivent être collectés séparément ou compostés sur place. Les bordereaux de collecte servent de preuve en cas de contrôle.",
            "À faire : désigner un prestataire de collecte et ranger ses bordereaux dans les justificatifs Environnement.",
        ],
        sourceName: "Ministère de la Transition écologique",
        sourceUrl: null,
    },
    {
        ...mockDashboardSummary.latestNews[2],
        summary:
            "Des délais de réponse indicatifs aident à traiter les réclamations clients de façon homogène.",
        paragraphs: [
            "Un accusé de réception sous 48 heures et une réponse complète sous 15 jours ouvrés sont recommandés pour les réclamations clients.",
            "Chaque réclamation doit être enregistrée, analysée et, si besoin, transformée en action corrective suivie dans le plan d'actions.",
            "À faire : vérifier que les réclamations de l'année ont toutes une date de réponse.",
        ],
        sourceName: "Guide qualité (exemple)",
        sourceUrl: null,
    },
];

// --- QHSE pillar pages -----------------------------------------------------

/** Diagnostic themes per pillar (from the DATA-01 draft referential). */
const MOCK_THEMES: Record<DomainKey, ThemeScore[]> = {
    quality: [
        { id: "qua.steering", label: "Pilotage et objectifs", score: 80 },
        {
            id: "qua.customers",
            label: "Satisfaction et réclamations clients",
            score: 74,
        },
        {
            id: "qua.nonconformities",
            label: "Non-conformités et actions correctives",
            score: 61,
        },
        { id: "qua.audits", label: "Audits internes", score: 55 },
        { id: "qua.documents", label: "Maîtrise documentaire", score: 88 },
    ],
    hygiene: [
        {
            id: "hyg.premises",
            label: "Hygiène des locaux et des postes",
            score: 70,
        },
        {
            id: "hyg.health",
            label: "Santé au travail et suivi médical",
            score: 52,
        },
        { id: "hyg.ergonomics", label: "Gestes et postures", score: 45 },
        { id: "hyg.psychosocial", label: "Risques psychosociaux", score: 58 },
        { id: "hyg.firstaid", label: "Premiers secours", score: 66 },
    ],
    safety: [
        { id: "saf.duerp", label: "Évaluation des risques (DUERP)", score: 35 },
        { id: "saf.ppe", label: "Équipements de protection", score: 62 },
        { id: "saf.training", label: "Formations et habilitations", score: 48 },
        { id: "saf.fire", label: "Incendie et évacuation", score: 57 },
        { id: "saf.checks", label: "Vérifications périodiques", score: 44 },
    ],
    environment: [
        { id: "env.waste", label: "Déchets et tri", score: 82 },
        { id: "env.energy", label: "Énergie et eau", score: 71 },
        { id: "env.chemicals", label: "Produits dangereux", score: 68 },
        {
            id: "env.compliance",
            label: "Conformité réglementaire",
            score: 79,
        },
        { id: "env.awareness", label: "Sensibilisation", score: 85 },
    ],
};

const MOCK_EXTRA_ACTIONS: ActionSummary[] = [
    {
        id: "action-5",
        title: "Mettre à jour le DUERP",
        domain: "safety",
        ownerName: "Camille Martin",
        dueDate: "2026-10-10T00:00:00.000Z",
        status: "in_progress",
    },
    {
        id: "action-6",
        title: "Afficher le protocole de nettoyage des vestiaires",
        domain: "hygiene",
        ownerName: "Inès Moreau",
        dueDate: "2026-10-14T00:00:00.000Z",
        status: "todo",
    },
    {
        id: "action-7",
        title: "Analyser les 3 réclamations clients de septembre",
        domain: "quality",
        ownerName: "Léo Bernard",
        dueDate: "2026-10-27T00:00:00.000Z",
        status: "todo",
    },
    {
        id: "action-8",
        title: "Relever les compteurs d'eau du site",
        domain: "environment",
        ownerName: "Inès Moreau",
        dueDate: "2026-11-03T00:00:00.000Z",
        status: "todo",
    },
];

const MOCK_DOCUMENTS: Record<DomainKey, ExpiringDocument[]> = {
    quality: [
        {
            id: "doc-q1",
            title: "Certificat ISO 9001",
            dueDate: "2026-12-01T00:00:00.000Z",
        },
    ],
    hygiene: [
        {
            id: "doc-h1",
            title: "Contrat de dératisation",
            dueDate: "2026-10-30T00:00:00.000Z",
        },
        {
            id: "doc-h2",
            title: "Attestation de formation SST de L. Bernard",
            dueDate: "2026-11-20T00:00:00.000Z",
        },
    ],
    safety: [
        {
            id: "doc-s1",
            title: "Rapport de vérification des extincteurs",
            dueDate: "2026-10-12T00:00:00.000Z",
        },
        {
            id: "doc-s2",
            title: "Habilitation électrique de L. Bernard",
            dueDate: "2026-10-28T00:00:00.000Z",
        },
        {
            id: "doc-s3",
            title: "Rapport de vérification du chariot élévateur",
            dueDate: "2026-12-05T00:00:00.000Z",
        },
    ],
    environment: [
        {
            id: "doc-e1",
            title: "Contrat d'enlèvement des déchets",
            dueDate: "2026-11-05T00:00:00.000Z",
        },
    ],
};

function mockDomainDetail(domain: DomainKey): DomainDetail {
    const score = mockDashboardSummary.domains.find((d) => d.domain === domain);
    const byDue = (a: { dueDate: string }, b: { dueDate: string }) =>
        a.dueDate.localeCompare(b.dueDate);
    return {
        generatedAt: mockDashboardSummary.generatedAt,
        domain,
        score: score?.score ?? null,
        previousScore: score?.previousScore ?? null,
        themes: MOCK_THEMES[domain],
        actions: [
            ...mockDashboardSummary.upcomingActions,
            ...MOCK_EXTRA_ACTIONS,
        ]
            .filter((action) => action.domain === domain)
            .sort(byDue)
            .slice(0, 5),
        expiringDocuments: [...MOCK_DOCUMENTS[domain]].sort(byDue),
        latestNews: mockDashboardSummary.latestNews.filter(
            (news) => news.domain === domain,
        ),
    };
}

export const mockDomainDetails: Record<DomainKey, DomainDetail> = {
    quality: mockDomainDetail("quality"),
    hygiene: mockDomainDetail("hygiene"),
    safety: mockDomainDetail("safety"),
    environment: mockDomainDetail("environment"),
};

/** A short questionnaire with every type of question (two per pillar). */
export const mockQuestionnaire: Questionnaire = {
    version: "mock-1",
    pillars: [
        {
            id: "quality",
            label: "Qualité",
            themes: [
                {
                    id: "pilotage",
                    label: "Pilotage et objectifs",
                    questions: [
                        {
                            id: "quality.pilotage.01",
                            label: "Votre entreprise a-t-elle fixé des objectifs qualité mesurables ?",
                            help: "Par exemple : taux de réclamations, délais de livraison.",
                            type: "yes_no",
                        },
                        {
                            id: "quality.pilotage.02",
                            label: "À quelle fréquence la direction fait-elle le point sur ces objectifs ?",
                            type: "scale",
                            levels: [
                                "Jamais",
                                "Une fois par an",
                                "Chaque trimestre",
                                "Chaque mois",
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "hygiene",
            label: "Hygiène-Santé",
            themes: [
                {
                    id: "sante",
                    label: "Santé au travail",
                    questions: [
                        {
                            id: "hygiene.sante.01",
                            label: "Tous les salariés sont-ils suivis par un service de prévention et de santé au travail ?",
                            reference: "Code du travail, art. L4624-1",
                            type: "yes_no",
                        },
                        {
                            id: "hygiene.secours.02",
                            label: "Quels aménagements limitent les gestes pénibles sur les postes de travail ?",
                            help: "Plusieurs réponses possibles.",
                            type: "multi_choice",
                            allow_na: true,
                            options: [
                                {
                                    id: "handling",
                                    label: "Aides à la manutention",
                                },
                                {
                                    id: "screens",
                                    label: "Postes sur écran réglables",
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: "safety",
            label: "Sécurité",
            themes: [
                {
                    id: "risques",
                    label: "Évaluation des risques",
                    questions: [
                        {
                            id: "safety.risques.01",
                            label: "Votre document unique d'évaluation des risques (DUERP) est-il à jour ?",
                            reference: "Code du travail, art. R4121-1",
                            type: "single_choice",
                            options: [
                                { id: "none", label: "Nous n'en avons pas" },
                                { id: "old", label: "Il date de plus d'un an" },
                                {
                                    id: "year",
                                    label: "Il a été mis à jour cette année",
                                },
                            ],
                        },
                        {
                            id: "safety.incendie.01",
                            label: "Un exercice d'évacuation a-t-il eu lieu au cours des 6 derniers mois ?",
                            type: "yes_no",
                        },
                    ],
                },
            ],
        },
        {
            id: "environment",
            label: "Environnement",
            themes: [
                {
                    id: "dechets",
                    label: "Déchets",
                    questions: [
                        {
                            id: "environment.dechets.01",
                            label: "Le tri des déchets est-il organisé ?",
                            type: "scale",
                            levels: ["Non", "Partiellement", "Oui"],
                        },
                        {
                            id: "environment.dechets.02",
                            label: "Conservez-vous les bordereaux de suivi de vos déchets dangereux ?",
                            type: "yes_no",
                            allow_na: true,
                        },
                    ],
                },
            ],
        },
    ],
};

/** No diagnostic started yet: the page opens on its introduction. */
export const mockCurrentDiagnostic: CurrentDiagnostic = {
    draft: null,
    lastSubmittedAt: null,
};

/** Score of a submitted diagnostic, on the questions of mockQuestionnaire. */
export const mockDiagnosticResult: DiagnosticResult = {
    diagnosticId: "1",
    submittedAt: "2026-10-12T09:00:00.000Z",
    questionnaireVersion: "mock-1",
    score: {
        global: 61.9,
        maturity: "Maîtrisé",
        pillars: { quality: 72, hygiene: 58.3, safety: 49.5, environment: 77 },
        themes: { pilotage: 72, sante: 58.3, risques: 49.5, dechets: 77 },
        coverage: 1,
        gaps: [
            {
                question_id: "safety.risques.01",
                label: "Votre document unique d'évaluation des risques (DUERP) est-il à jour ?",
                pillar: "safety",
                theme: "risques",
                score: 30,
                potential_points: 8.75,
                capped_for_proof: false,
            },
            {
                question_id: "hygiene.sante.01",
                label: "Tous les salariés sont-ils suivis par un service de prévention et de santé au travail ?",
                pillar: "hygiene",
                theme: "sante",
                score: 50,
                potential_points: 6.25,
            },
        ],
        algoVersion: "1.0.0",
    },
    previous: {
        submittedAt: "2026-07-01T09:00:00.000Z",
        global: 57,
        pillars: { quality: 65, hygiene: 60, safety: 45, environment: 70 },
    },
};
