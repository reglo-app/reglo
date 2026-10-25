# Contributing to REGLO

Short guide for the team. Read it once, then keep it as a reference.

## 1. Branches and environments

| Branch | Purpose | Deployed to |
|---|---|---|
| `main` | Stable code, released versions | Production: https://app.reglo.site |
| `develop` | Integration of finished work | Pre-production: https://preprod.reglo.site |
| `feature/US-xx-short-name` | One user story | Nobody (local only) |

Rules:
- Nobody pushes directly to `main` or `develop`. Everything goes through a pull request (PR).
- Work branches are created from `develop`.
- Other branch prefixes: `fix/short-name`, `chore/short-name`, `docs/short-name`, `ci/short-name`.
- Branches are deleted automatically on GitHub after the merge.

Examples: `feature/US-01-activate-organization`, `fix/login-lockout`, `chore/add-docker-compose`.

## 2. Local environment

Everything runs with Docker. See the [README](README.md) for the full setup.

```
cp .env.example .env
make up
```

`make up` waits until every service is healthy, then prints the local URLs. Useful commands (run `make help` for the full list):

| Command | Description |
|---|---|
| `make up` / `make down` | Start / stop all services |
| `make test` | Run the API and web unit tests |
| `make lint` | Run PHP-CS-Fixer, PHPStan, Prettier and ESLint |

If a port is already in use, another copy of the project is probably still running: run `make down` in it first.

## 3. Daily workflow

### Step 1: Start from an up-to-date `develop`
```
git checkout develop
git pull origin develop
```

### Step 2: Create your branch
```
git checkout -b feature/US-02-secure-login
```

### Step 3: Code, then commit often
```
git add .
git status
git commit -m "feat: add login form"
```
Check `git status` before each commit: no `.env` file, no secret, no unwanted file.

### Step 4: Run the checks locally
```
make lint
make test
```

### Step 5: Push your branch
```
git push -u origin feature/US-02-secure-login
```
(After the first push, `git push` is enough.)

### Step 6: Open a pull request
1. On GitHub, click **Compare & pull request**.
2. Check that **base** is `develop`.
3. Fill in the template (linked user story, description, checklist).
4. Click **Create pull request**.

### Step 7: Review
- Another team member reviews the PR: **Files changed** > **Review changes** > **Approve** (or **Request changes**).
- Code owners are requested automatically (see `.github/CODEOWNERS`).
- Fix the comments with new commits on the same branch. Do not open a new PR.
- Resolve all conversations before merging.

### Step 8: Merge
- The CI must be green (see section 6).
- Use **Squash and merge**. The PR title becomes the commit message, so it must follow the commit convention.
- The branch is deleted automatically.

### Step 9: Clean up locally
```
git checkout develop
git pull origin develop
git fetch --prune
git branch -D feature/US-02-secure-login
```
To prune automatically on every fetch or pull: `git config --global fetch.prune true`.

## 4. Commit convention

Format: `type: short description`

- In English, lowercase, imperative mood ("add", not "added").
- No period at the end. 72 characters maximum.

| Type | Use for |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `chore` | Config, tooling, dependencies |
| `test` | Adding or updating tests |
| `refactor` | Code change without behavior change |
| `ci` | GitHub Actions pipelines |

Good: `feat: add organization creation`, `fix: block login after 5 failed attempts`.
Bad: `update`, `wip`, `fix stuff`, `Added login`.

Optional scope: `feat(api): add organization endpoint`, `fix(web): correct score chart`.

## 5. Pull request rules

- One PR = one user story (or one small task). Keep it small and easy to review.
- The PR must link its user story (`Closes #12`).
- Tests are added or updated with the code.
- Lint and tests must pass locally before pushing.
- Never commit secrets, passwords, tokens or `.env` files. Use `.env.example` for variable names only.
- Database changes go through Doctrine migrations (see section 7).

## 6. Continuous integration

Every PR runs two workflows. Both must pass before merging, and the branch must be up to date with its target (use **Update branch** on the PR if needed).

| Check | What it runs |
|---|---|
| `API checks` | PHP-CS-Fixer, PHPStan, PHPUnit |
| `Web checks` | Prettier, ESLint, Vitest, build, Playwright |

The merge is blocked while a check is running or red, for everyone. Repository admins can skip the review requirement, but must never merge on a red CI.

## 7. Deployment and releases

### How it works
Deployment is automatic, with the **Deploy** workflow (GitHub Actions):

1. Docker images of the API and the web app are built and pushed to GitHub Container Registry, tagged with the commit SHA.
2. The compose file is copied to the server, the new images are pulled and the services restarted.
3. Doctrine migrations are run (`doctrine:migrations:migrate`).

| Event | Result |
|---|---|
| Merge into `develop` | Deployment to pre-production |
| Merge into `main` | Deployment to production (may wait for a manual approval) |

Secrets (SSH key, server address) are stored in GitHub Environments. Application secrets live in the `.env` files on the server. Neither is ever in the repository.

### Database migrations
- Migrations run automatically at each deployment.
- Never edit a migration that has already been merged: create a new one.
- Make migrations safe to run on existing data.

### Releasing to production
1. Check that the last **Deploy** run on `develop` is green and that pre-production works.
2. Open a PR `develop` > `main`, titled `chore: release vX.Y.Z`.
3. Wait for the CI, then merge with **Create a merge commit**. **Never squash** into `main`: it makes `develop` and `main` diverge.
4. If asked, approve the deployment: **Actions** > the run > **Review deployments**.
5. Check https://app.reglo.site.
6. Tag the release locally, then push it:
```
git checkout main
git pull origin main
git tag vX.Y.Z
git push origin vX.Y.Z
git checkout develop
```
7. Synchronize `develop`: open a PR `main` > `develop` titled `chore: sync develop with main` and merge it with **Create a merge commit**. Without it, `develop` is one commit behind and the next release PR is blocked.

Version numbers: `v0.x.y` until the first complete release, then `MAJOR.MINOR.PATCH`.

### Hotfix
For an urgent bug in production: branch `fix/short-name` from `main`, PR into `main` (merge commit), deploy, then synchronize `develop` as above.

### Rollback
If a release breaks production, redeploy the previous version:
1. In **Actions**, find the SHA of the last good **Deploy** run on `main`.
2. On the server, in `/srv/reglo-prod`, set `IMAGE_TAG=<that SHA>` in `.env`.
3. Run `docker compose up -d --wait`.

Database migrations are not rolled back automatically: ask the team before rolling back a release that contains one.

## 8. Project structure

```
reglo/
  api/            Backend: Symfony + API Platform (PHP)
  web/            Frontend: Next.js (TypeScript)
  data-service/   Data service: Python / FastAPI and other data tools
  deploy/         Compose files used on the server (pre-production and production, Adminer)
  .github/        CI and deploy workflows, CODEOWNERS, PR template
```

Each application has a development `Dockerfile` (used by `docker-compose.yml`) and a `Dockerfile.prod` (used for deployment).

## 9. Common mistakes

**Wrong commit message (not pushed yet)**
```
git commit --amend -m "feat: correct message"
```

**Commit made on the wrong branch (not pushed yet)**
```
git branch feature/my-branch
git reset --hard origin/develop
git checkout feature/my-branch
```

**My branch is behind `develop`**
```
git checkout develop
git pull origin develop
git checkout feature/my-branch
git merge develop
```

**Push rejected on `develop` or `main`**
This is expected: the branches are protected. Create a work branch and open a PR.

**Merge blocked on a PR**
Check the list under the PR: a review is missing, a check is running or red, or the branch is not up to date (click **Update branch**).

**Merge conflict**
Do not panic. Open the conflicting files, keep the right code, remove the `<<<<<<<` markers, then:
```
git add .
git commit -m "chore: resolve merge conflicts"
```
If unsure, ask the team before pushing.

**`api/config/reference.php` appears in `git status`**
Symfony regenerates it. Do not commit it: `git restore --staged api/config/reference.php` then `git restore api/config/reference.php`.

## 10. Quick rules

1. Never work directly on `develop` or `main`.
2. Always pull before creating a branch.
3. Small commits, clear messages, in English.
4. One PR per user story, reviewed by someone else.
5. Squash and merge into `develop`, merge commit into `main`.
6. Never commit secrets.
