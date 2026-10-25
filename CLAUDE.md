# REGLO – Project guide for Claude Code

REGLO is a fictive SaaS startup (student project, MDSU master) that helps companies with QHSE (Quality, Hygiene-Health, Safety, Environment): self-diagnostic with a score per domain, action plan, evidence documents, training, regulatory news. Team of 7: 2 developers, 1 data, 1 cybersecurity, 1 marketing, 2 designers. Final presentation: end of February 2027. Solution freeze: 22 January 2027.

## Language rules
- Code, comments, commits, PR titles/descriptions, branch names, docs in the repo: **English**.
- User interface texts and e-mails sent to users: **French**.
- Trello cards are written in French. Reply to the team in French.

## Stack and structure
```
api/            Symfony 7.4 + API Platform + Doctrine (PHP 8.3, PostgreSQL 16)
web/            Next.js (TypeScript, Tailwind, App Router)
data-service/   Python FastAPI (score computation), owned by the data person
deploy/         Compose file used on the server (preprod and prod)
.github/        CI and deploy workflows, CODEOWNERS, PR template
```
- Local: Docker Compose. Mail in dev: Mailpit. Reverse proxy on the server: Caddy (`/api` and `/bundles` go to the API, the rest to Next.js).
- Environments: https://preprod.reglo.site (branch `develop`), https://app.reglo.site (branch `main`).
- The data-service is only reachable from the API on the internal Docker network (`DATA_SERVICE_URL`). Never expose it publicly.

## Commands (run from the repo root)
- `make up` / `make down`: start / stop everything
- `make test`: API and web unit tests
- `make lint`: PHP-CS-Fixer, PHPStan, Prettier, ESLint
- API tests in the container need `-e APP_ENV=test`.
- Run `make lint` and `make test` before every push. CI must be green to merge.

## Git workflow (see CONTRIBUTING.md for details)
- Never push to `main` or `develop`. Everything goes through a PR.
- Branch from an up-to-date `develop`: `feature/US-xx-short-name`, `fix/...`, `chore/...`, `docs/...`, `ci/...`, `test/...`.
- Commits: Conventional Commits in English, imperative, lowercase, no period, 72 chars max. Example: `feat: add organization creation`. Optional scope: `feat(api): ...`.
- One PR = one Trello card. Squash and merge into `develop`. Merge commit (never squash) into `main`.
- Never commit secrets or `.env` files. New variables go in `.env.example` (and `deploy/.env.example`) with a comment.
- Database changes: Doctrine migrations only. Never edit a migration already merged.
- Do not commit `api/config/reference.php`.
- Code style: 4 spaces, LF line endings.

## Product rules that must never be broken
1. **Tenant isolation:** one organization = one company. A user must never read or write another organization's data. Filter by organization centrally and add every new resource to the isolation tests.
2. Permissions are enforced in the API (voters / security), never only in the UI. Roles: Administrator, Member, Reader.
3. Error messages shown to users are clear and never expose technical details. Login errors are generic.
4. Uploads: check the real file type, 20 MB maximum, stored outside the public folder with a random name, downloaded only through the authenticated API.
5. Accessibility target: RGAA / WCAG 2.1 AA (keyboard navigation, labels, contrast, text alternative for charts). Mobile and desktop.
6. Personal data (GDPR): collect the minimum, support export and erasure, keep a processing register.
7. The four pillars of the product are the QHSE domains: Quality, Hygiene-Health, Safety, Environment. Use these in scores, actions, documents, training and news. Technical keys: `quality`, `hygiene`, `safety`, `environment`.

## Tests (Definition of Done)
A task is done only when:
- Acceptance criteria of the card are met.
- Unit tests (PHPUnit / Vitest / pytest) and at least one API integration test per new endpoint exist; one Playwright E2E test for each critical user journey.
- Isolation, permission and error cases are tested, not only the happy path.
- `make lint` and `make test` pass, CI is green, a teammate reviewed the PR.
- Migration created, `.env.example` and docs updated if needed.
- Deployed to preprod and checked by hand after merge.

## Working from Trello
Board "DEV / CYBER / DATA" (Trello MCP connector). Columns: Backlog, À faire, En cours, En revue (PR), Terminé. Each card contains the story, acceptance criteria, numbered detailed tasks, tests, dependencies and a suggested branch name.
- Before coding: read the card, its dependencies and the "Definition of Done" card (list "RÈGLES & RÉFÉRENCES").
- Start: create the suggested branch from `develop`, move the card to "En cours".
- PR: put the card link in the "Trello card" section of the PR template, move the card to "En revue (PR)", add the PR link as a comment on the card.
- Done only after merge into `develop` and the checks above: move to "Terminé".
- Do not edit the scope of a card without telling the team (comment on the card instead).

## Backlog overview
Epics: E00 technical (TECH-01..09), E01 accounts (US-02, 03, 04, 16), E02 QHSE diagnostic and score (DATA-01, US-05..08), E03 action plan (US-09, 10), E04 evidence (US-11, 12), E05 training (US-13, 14), E06 regulatory news (US-15), E07 admin/onboarding (US-01), IT security (CYB-01..05).
Sprints (2 weeks): S0 12–23 Oct 2026, S1 26 Oct–6 Nov, S2 9–20 Nov, S3 23 Nov–4 Dec, S4 7–18 Dec, S5 21 Dec–22 Jan 2027, acceptance 25 Jan–12 Feb. MoSCoW priorities are in each card.

## Other docs
- `CONTRIBUTING.md`: full workflow, releases, hotfix, rollback.
- `README.md`: local setup.
- `docs/test-plan.md` (once TECH-09 is merged) and `docs/security/` (once CYB-01 is merged).
